import { compressPrompt } from "./compress";
import { extractConstraints } from "./constraints";
import { buildDiff } from "./diff";
import { buildExplanation } from "./explain";
import { adaptForModel } from "./model-adapters";
import { normalizePrompt } from "./normalize";
import { computeTransformationScores } from "./scoring";
import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type {
  ContinuityReview,
  ExtractedConstraint,
  ParsedCapsuleState,
  TransformRequest,
  TransformResult
} from "@luxcrypta/continuity-types/prompts";
import { firstMeaningfulLine, isMeaningfullyDuplicate, uniqueMeaningfulStrings } from "@luxcrypta/continuity-types/utils/text";

const PIPELINE_STEPS = [
  "detect contextual state",
  "detect capsule/workflow memory",
  "parse capsule semantically",
  "extract human continuity state",
  "separate stable, provisional, and open items",
  "reduce redundancy",
  "prioritize objective",
  "generate human-readable review",
  "generate final handoff",
  "attach diagnostics separately"
];

interface ParsedCapsuleResult {
  rawCapsule: CarryForwardCapsule;
  parsedCapsule: ParsedCapsuleState;
  sourceWithoutCapsule: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCarryForwardCapsule(value: unknown): value is CarryForwardCapsule {
  return (
    isRecord(value) &&
    value.capsule_version === 1 &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.objective === "string" &&
    Array.isArray(value.constraints) &&
    Array.isArray(value.decisions) &&
    Array.isArray(value.open_questions) &&
    typeof value.created_at === "string"
  );
}

function findBalancedJsonObject(text: string, startIndex: number): { start: number; end: number; jsonText: string } | null {
  const start = text.indexOf("{", startIndex);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { start, end: index + 1, jsonText: text.slice(start, index + 1) };
      }
    }
  }

  return null;
}

function capsuleSearchStart(text: string): number {
  const marker = text.match(/carry[-\s]?forward capsule\s*:/i);
  return marker?.index === undefined ? 0 : marker.index + marker[0].length;
}

function removeCapsuleBlock(text: string, jsonStart: number, jsonEnd: number): string {
  const markerPrefix = text.slice(0, jsonStart).match(/(?:^|\n)\s*carry[-\s]?forward capsule\s*:\s*$/i);
  const removeStart = markerPrefix?.index === undefined ? jsonStart : markerPrefix.index;
  return `${text.slice(0, removeStart)}\n${text.slice(jsonEnd)}`.replace(/\n{3,}/g, "\n\n").trim();
}

function extractJsonCapsule(text: string): { capsule: CarryForwardCapsule; start: number; end: number } | null {
  let cursor = capsuleSearchStart(text);
  while (cursor < text.length) {
    const found = findBalancedJsonObject(text, cursor);
    if (!found) return null;
    try {
      const parsed = JSON.parse(found.jsonText) as unknown;
      if (isCarryForwardCapsule(parsed)) {
        return { capsule: parsed, start: found.start, end: found.end };
      }
    } catch {
      // Continue scanning; the draft may contain unrelated braces before the capsule.
    }
    cursor = found.start + 1;
  }
  return null;
}

function splitNotes(notes: string | undefined): string[] {
  if (!notes?.trim()) return [];
  return notes
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function cleanStateLine(text: string): string {
  return text
    .replace(/^\s*[-*•]\s*/, "")
    .replace(
      /^\s*(objective|stable core|new\s*\/\s*provisional|open\s*\/\s*unresolved|continuity instructions|requirements?|hard requirements?|output contract|context|task|decision|constraint|requirement|open question|question|risk|uncertainty|note|new instruction):\s*/i,
      ""
    )
    .trim();
}

function normalizeCapsule(capsule: CarryForwardCapsule): ParsedCapsuleState {
  const notes = splitNotes(capsule.notes).map(cleanStateLine).filter(Boolean);
  const riskNotes = [...capsule.open_questions, ...notes].filter((item) =>
    /\b(risk|uncertain|uncertainty|unknown|blocked|unresolved|unclear)\b/i.test(item)
  );
  const nextActions = notes.filter((item) => /\b(next|action|todo|follow[-\s]?up|recommended|should)\b/i.test(item));

  return {
    active_objective: cleanStateLine(capsule.objective),
    stable_constraints: uniqueMeaningfulStrings(capsule.constraints.map(cleanStateLine).filter(Boolean)),
    accepted_decisions: uniqueMeaningfulStrings(capsule.decisions.map(cleanStateLine).filter(Boolean)),
    open_questions: uniqueMeaningfulStrings(capsule.open_questions.map(cleanStateLine).filter(Boolean)),
    unresolved_risks: uniqueMeaningfulStrings(riskNotes.map(cleanStateLine).filter(Boolean)),
    preferred_mode: capsule.preferred_mode,
    explicit_next_actions: uniqueMeaningfulStrings(nextActions),
    notes: uniqueMeaningfulStrings(notes),
    provider_target: capsule.sourceSurface,
    metadata: {
      id: capsule.id,
      title: capsule.title,
      capsule_version: capsule.capsule_version,
      created_at: capsule.created_at,
      updated_at: capsule.updated_at,
      sourceSurface: capsule.sourceSurface
    }
  };
}

function parseCapsuleState(text: string): ParsedCapsuleResult | null {
  const result = extractJsonCapsule(text);
  if (!result) return null;
  return {
    rawCapsule: result.capsule,
    parsedCapsule: normalizeCapsule(result.capsule),
    sourceWithoutCapsule: removeCapsuleBlock(text, result.start, result.end)
  };
}

function stripSectionLabel(text: string): string {
  return cleanStateLine(
    text.replace(
      /^\s*[-*•]?\s*(stable core|new\s*\/\s*provisional|open\s*\/\s*unresolved|what changed|recommended next actions|continuity instructions):\s*$/i,
      ""
    )
  );
}

const RUNTIME_SECTION_LABELS =
  "objective|stable core|new\\s*\\/\\s*provisional|open\\s*\\/\\s*unresolved|what changed|recommended next actions|continuity instructions";

function normalizeRuntimeScaffold(text: string): string {
  return text
    .replace(new RegExp(`\\s+(${RUNTIME_SECTION_LABELS}):\\s*`, "gi"), "\n$1: ")
    .replace(/\s+[-*•]\s+/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isDefaultContinuityInstructionLine(text: string): boolean {
  const cleaned = cleanStateLine(text);
  return (
    /^keep the stable core intact unless the user explicitly changes it\.?$/i.test(cleaned) ||
    /^reduce repetition and keep the response anchored to the active objective\.?$/i.test(cleaned) ||
    /^keep unresolved questions visible instead of silently resolving or dropping them\.?$/i.test(cleaned)
  );
}

function removeGeneratedRuntimeInstructions(text: string): string {
  return normalizeRuntimeScaffold(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^continuity instructions:?$/i.test(line) && !isDefaultContinuityInstructionLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isRuntimeScaffoldLine(text: string): boolean {
  return (
    !text.trim() ||
    /^(stable core|new\s*\/\s*provisional|open\s*\/\s*unresolved|what changed|recommended next actions|continuity instructions):?$/i.test(
      text.trim()
    ) || isDefaultContinuityInstructionLine(text)
  );
}

function statementsFromText(text: string): string[] {
  const prepared = removeGeneratedRuntimeInstructions(text);
  return uniqueMeaningfulStrings(
    prepared
      .replace(/\s+(requirements?|hard requirements?|output contract|context|open questions?):\s*/gi, "\n$1:\n")
      .replace(/\s+[-*•]\s+/g, "\n- ")
      .split(/\n|(?<=[.!?])\s+/)
      .map((line) => stripSectionLabel(line).trim())
      .filter((line) => line.length > 3 && !/^carry[-\s]?forward capsule:?$/i.test(line) && !isRuntimeScaffoldLine(line))
  ).slice(0, 12);
}

function isCoveredBy(existing: string[], candidate: string): boolean {
  return existing.some((item) => isMeaningfullyDuplicate(item, candidate, 0.72));
}

function objectiveFromText(text: string, fallback = "Continue the active workflow."): string {
  const prepared = removeGeneratedRuntimeInstructions(text);
  const objectiveMatch = prepared.match(/(?:^|\n)\s*objective:\s*([^\n]*)/i);
  const objective = objectiveMatch?.[1] ? stripSectionLabel(objectiveMatch[1]).slice(0, 240) : "";
  if (objective) return objective;

  const firstCandidate = prepared
    .split("\n")
    .map((line) => stripSectionLabel(line))
    .find((line) => line.length > 3 && !isRuntimeScaffoldLine(line));
  return (firstCandidate ?? firstMeaningfulLine(prepared, fallback)).slice(0, 240) || fallback;
}

function section(title: string, lines: string[]): string {
  const content = lines.map((line) => line.trim()).filter(Boolean);
  if (!content.length) return "";
  return [`${title}:`, ...content.map((line) => `- ${line}`)].join("\n");
}

function buildContinuitySource(input: {
  parsedCapsule?: ParsedCapsuleState;
  newInstructionText: string;
  sourceText: string;
}): string {
  const capsule = input.parsedCapsule;
  const capsuleLines = capsule
    ? [
        capsule.active_objective ? `Objective: ${capsule.active_objective}` : "",
        ...capsule.stable_constraints.map((item) => `Requirement: ${item}`),
        ...capsule.accepted_decisions.map((item) => `Decision: ${item}`),
        ...capsule.open_questions.map((item) => `Open question: ${item}`),
        ...capsule.unresolved_risks.map((item) => `Risk: ${item}`),
        ...capsule.notes.map((item) => `Note: ${item}`)
      ].filter(Boolean)
    : [];
  const bodyText = capsule ? input.newInstructionText : input.sourceText;
  return [...capsuleLines, bodyText].filter(Boolean).join("\n");
}

function buildReview(input: {
  sourceText: string;
  normalized: string;
  reduced: string;
  constraints: ExtractedConstraint[];
  parsedCapsuleResult: ParsedCapsuleResult | null;
  request: TransformRequest;
}): ContinuityReview {
  const parsed = input.parsedCapsuleResult?.parsedCapsule;
  const newInstructionText = input.parsedCapsuleResult?.sourceWithoutCapsule ?? input.sourceText;
  const activeObjective = parsed?.active_objective ?? objectiveFromText(input.reduced || input.normalized);
  const hardConstraints = input.constraints.filter((constraint) => constraint.hard).map((constraint) => constraint.text);
  const stableCore = uniqueMeaningfulStrings([
    ...hardConstraints,
    ...(parsed?.stable_constraints ?? []),
    ...(parsed?.accepted_decisions.map((item) => `Decision: ${item}`) ?? [])
  ]).filter((item) => !isMeaningfullyDuplicate(item, activeObjective, 0.78));
  const openUnresolved = uniqueMeaningfulStrings([
    ...(parsed?.open_questions ?? []),
    ...(parsed?.unresolved_risks.map((item) => `Risk: ${item}`) ?? []),
    ...statementsFromText(newInstructionText).filter((item) =>
      /\?|open question|unclear|unknown|risk|unresolved|needs confirmation/i.test(item)
    )
  ]);
  const stableAndOpen = [activeObjective, ...stableCore, ...openUnresolved];
  const newProvisional = statementsFromText(newInstructionText)
    .filter((item) => !isCoveredBy(stableAndOpen, item))
    .filter((item) => !/^no new/i.test(item))
    .slice(0, 8);
  const whatChanged = uniqueMeaningfulStrings([
    parsed ? "Parsed the carry-forward capsule into human-readable continuity state." : "Parsed the current draft into continuity state.",
    "Reduced redundant wording and repeated requirements.",
    "Prioritized the active objective as the default runtime behavior.",
    newProvisional.length ? "Separated new or provisional instructions from stable state." : "",
    openUnresolved.length ? "Kept open or unresolved items visible." : ""
  ]);
  const recommendedNextActions = uniqueMeaningfulStrings([
    newProvisional.length ? "Review the New / Provisional items before treating them as stable." : "",
    openUnresolved.length ? "Resolve, answer, or deliberately carry forward the Open / Unresolved items." : "",
    parsed?.explicit_next_actions.length ? parsed.explicit_next_actions.join("; ") : "",
    "Apply the transformed handoff when the Active Objective and Stable Core look right."
  ]);
  const cleanSummary = parsed
    ? `Parsed "${parsed.metadata.title ?? "carry-forward capsule"}" and merged it with the current instructions into one continuity pass.`
    : "Processed the current draft through the always-on continuity runtime.";

  return {
    cleanSummary,
    activeObjective,
    stableCore,
    newProvisional,
    openUnresolved,
    whatChanged,
    recommendedNextActions,
    diagnostics: {
      pipelineSteps: PIPELINE_STEPS,
      parsedCapsule: parsed,
      rawCapsule: input.parsedCapsuleResult?.rawCapsule,
      sourceSurface: input.request.sourceSurface,
      requestedMode: input.request.mode,
      targetModel: input.request.targetModel
    }
  };
}

function buildFinalHandoff(review: ContinuityReview): string {
  const chunks = [
    `Objective: ${review.activeObjective}`,
    section("Stable Core", review.stableCore),
    section("New / Provisional", review.newProvisional),
    section("Open / Unresolved", review.openUnresolved),
    section("Continuity Instructions", [
      "Keep the stable core intact unless the user explicitly changes it.",
      "Reduce repetition and keep the response anchored to the active objective.",
      "Keep unresolved questions visible instead of silently resolving or dropping them."
    ])
  ].filter(Boolean);
  return chunks.join("\n\n").trim();
}

export function transformPrompt(request: TransformRequest): TransformResult {
  const parsedCapsuleResult = parseCapsuleState(request.sourceText);
  const continuitySource = removeGeneratedRuntimeInstructions(buildContinuitySource({
    parsedCapsule: parsedCapsuleResult?.parsedCapsule,
    newInstructionText: parsedCapsuleResult?.sourceWithoutCapsule ?? "",
    sourceText: request.sourceText
  }));
  const normalized = normalizePrompt(continuitySource);
  const constraints = extractConstraints(normalized);
  const compressed = compressPrompt(normalized, constraints, { ...request, sourceText: continuitySource });
  const review = buildReview({
    sourceText: request.sourceText,
    normalized,
    reduced: compressed,
    constraints,
    parsedCapsuleResult,
    request
  });
  const handoff = buildFinalHandoff(review);
  const modelAdjusted = adaptForModel(handoff, request.targetModel, request.mode);
  const diff = buildDiff(normalized, modelAdjusted);
  const explanation = buildExplanation({
    original: request.sourceText,
    normalized,
    transformed: modelAdjusted,
    constraints,
    targetModel: request.targetModel
  });
  const scores = computeTransformationScores({
    original: request.sourceText,
    transformed: modelAdjusted,
    constraints,
    targetModel: request.targetModel
  });

  return {
    originalText: request.sourceText,
    normalizedText: normalized,
    transformedText: modelAdjusted,
    targetModelApplied: request.targetModel,
    extractedConstraints: constraints,
    explanation,
    diff,
    scores,
    continuityReview: review
  };
}
