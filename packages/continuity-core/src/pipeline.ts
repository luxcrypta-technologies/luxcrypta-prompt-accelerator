import { compressPrompt } from "./compress";
import { extractConstraints } from "./constraints";
import { buildDiff } from "./diff";
import { buildExplanation } from "./explain";
import { adaptForModel } from "./model-adapters";
import { normalizePrompt } from "./normalize";
import { computeTransformationScores } from "./scoring";
import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type {
  AdversarialGovernanceState,
  CanonicalContinuityItem,
  ContinuityPrimaryBucket,
  ContinuitySourceRole,
  ContinuityReview,
  ExtractedConstraint,
  MutationTarget,
  ParsedCapsuleState,
  TransformRequest,
  TransformResult
} from "@luxcrypta/continuity-types/prompts";
import {
  firstMeaningfulLine,
  isMeaningfullyDuplicate,
  uniqueMeaningfulStrings
} from "@luxcrypta/continuity-types/utils/text";

const PIPELINE_STEPS = [
  "detect contextual state",
  "detect capsule/workflow memory",
  "parse capsule semantically",
  "partition trusted and untrusted state",
  "extract human continuity state",
  "separate stable, provisional, open, rejected, and quarantine items",
  "reduce redundancy",
  "prioritize objective",
  "apply semantic admission filtering",
  "normalize governance buckets",
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

function findBalancedJsonObject(
  text: string,
  startIndex: number
): { start: number; end: number; jsonText: string } | null {
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
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
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
  const markerPrefix = text
    .slice(0, jsonStart)
    .match(/(?:^|\n)\s*carry[-\s]?forward capsule\s*:\s*$/i);
  const removeStart = markerPrefix?.index === undefined ? jsonStart : markerPrefix.index;
  return `${text.slice(0, removeStart)}\n${text.slice(jsonEnd)}`.replace(/\n{3,}/g, "\n\n").trim();
}

function extractJsonCapsule(
  text: string
): { capsule: CarryForwardCapsule; start: number; end: number } | null {
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
  const nextActions = notes.filter((item) =>
    /\b(next|action|todo|follow[-\s]?up|recommended|should)\b/i.test(item)
  );

  return {
    active_objective: cleanStateLine(capsule.objective),
    stable_constraints: uniqueMeaningfulStrings(
      capsule.constraints.map(cleanStateLine).filter(Boolean)
    ),
    accepted_decisions: uniqueMeaningfulStrings(
      capsule.decisions.map(cleanStateLine).filter(Boolean)
    ),
    open_questions: uniqueMeaningfulStrings(
      capsule.open_questions.map(cleanStateLine).filter(Boolean)
    ),
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
  "objective|stable core|new\\s*\\/\\s*provisional|open\\s*\\/\\s*unresolved|what changed|recommended next actions|continuity instructions|trusted state|trusted_state|untrusted instructions|untrusted_instructions|quarantine log|quarantine_log|deferred items|deferred item|deferred_items|conditional admissions|conditional admission|conditional_admissions|rejected directions|rejected direction|rejected_directions|governance principles|governance principle|governance_principles|invariants|invariant|continuity safeguards|continuity safeguard|continuity_safeguards|mutation targets|mutation target|mutation risk|task local instructions|task-local instructions|task_local_instructions|task local forbidden|task-local forbidden|task_local_forbidden";

const STRICT_REJECT_RE =
  /\b(do not|don't|never|avoid|forbidden|prohibited|must not|should not|cannot execute|cannot merge|exclude|reject\s+(?:this|that|the|any|all)|do not accept|do not ignore|do not flatten|do not turn|do not reintroduce|do not expose)\b/i;
const UNTRUSTED_RE =
  /\b(untrusted|conflicting instruction|adversarial|override block|new instruction block|attack|malicious|ignore previous|bypass|replace trusted|discard trusted)\b/i;
const QUARANTINE_RE =
  /\b(quarantine|analysis only|not executable|do not execute|preserve for analysis|retrieved evidence|retrieval context|external evidence|citation|source card|search result|web result)\b/i;
const DEFER_RE =
  /\b(defer|deferred|pending validation|pending explicit validation|not accepted yet|later if|requires validation|until validated)\b/i;
const CONDITIONAL_ADMIT_RE =
  /\b(conditional(?:ly)? admit|conditional admission|admissible only|only if|if validated|provided that|with validation|with conditions?)\b/i;
const GOVERNANCE_PRINCIPLE_RE =
  /\b(governance|trusted state|untrusted|admission|taxonomy|state boundary|conflict handling|audit|visibility|integrity|priority|review state)\b/i;
const INVARIANT_RE =
  /\b(invariant|must remain|durable|non-negotiable|no silent transitions|identity anchoring|operational identity|always-on|always on)\b/i;
const CONTINUITY_SAFEGUARD_RE =
  /\b(continuity safeguard|safeguard|continuity anchor|carry[-\s]?forward|reconstruction|preserve continuity|preserve unresolved|keep unresolved|no silent transitions|audit visibility)\b/i;
const MUTATION_RE =
  /\b(override|mutation|mutate|replace|delete|remove|suppress|hidden rewrite|forced resolution|force resolution|false claim|insert false|state override|delete safeguards|suppress audit|ignore previous|discard trusted)\b/i;
const TASK_LOCAL_RE =
  /\b(follow the required format|required format|end with (?:a )?(?:score|rating)|final scores?|reconstruction confidence score|give (?:a )?table|use (?:a )?table|separate into \d+ sections?|include a vulnerability paragraph|build a priority model|stage \d+|return (?:the )?(?:answer|response) as|answer[-\s]?shape|response format|markdown table|bullet list|numbered list|write in (?:four|five|six|\d+) sections?)\b/i;
const PROMPT_SCAFFOLD_RE =
  /\b(below is|here is|structured response|final response|stage \d+|step \d+|copy[-\s]?paste|prompt block|prompt scaffolding|response wrapper|answer contract|final scores?|reconstruction confidence score)\b/i;
const ADOPTION_RE =
  /\b(adopt|promote|save|remember|make (?:this|it) canonical|this is canonical|treat (?:this|it) as stable|user[-\s]?promoted|explicitly adopted)\b/i;
const SPEAKER_PREFIX_RE = /^\s*(?:user|assistant|system|developer|model|human|ai)\s*:\s*/i;
const SECTION_LABEL_RE =
  /^\s*(?:[-*•>]+\s*)?(trusted state|trusted_state|stable state|stable core|objective|untrusted instructions|untrusted_instructions|conflicting instructions|quarantine log|quarantine_log|quarantine|quarantined item|deferred items|deferred item|deferred_items|defer|conditional admissions|conditional admission|conditional_admissions|conditional admit|rejected directions|rejected direction|rejected_directions|rejections|governance principles|governance principle|governance_principles|invariants|invariant|continuity safeguards|continuity safeguard|continuity_safeguards|mutation targets|mutation target|mutation risk|open unresolved|open\/unresolved|new provisional|new\/provisional|admitted updates|task local instructions|task-local instructions|task_local_instructions|task local forbidden|task-local forbidden|task_local_forbidden)(?::\s*(.*)|\s*)$/i;

function normalizeRuntimeScaffold(text: string): string {
  return text
    .replace(new RegExp(`\\s+(${RUNTIME_SECTION_LABELS}):\\s*`, "gi"), "\n$1: ")
    .replace(/\s+[-*•]\s+/g, "\n- ")
    .replace(/([.!?])\s*([A-Z]\d+)(?=[A-Z])/g, "$1\n$2 ")
    .replace(/([a-z)])([A-Z]\d+)(?=[A-Z])/g, "$1\n$2 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function providerId(request: TransformRequest): string {
  return (
    request.sourceSurface ??
    request.providerProfile?.provider ??
    request.targetModel ??
    ""
  ).toLowerCase();
}

function isPerplexityUiArtifact(text: string): boolean {
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    /^(showmore|showless|showmoreshowless|copied|copylink|share|rewrite|sources|related|askfollowup|thread|library|discover|home|settings|signindashboard|upgrade|viewmore|viewless|trypro|perplexity)$/.test(
      clean
    ) ||
    /^(show more|show less|related questions|ask follow-up|view sources|copy link|share thread|rewrite answer|search images|search videos|spaces|library|discover|sign in|try pro|upgrade)$/i.test(
      text.trim()
    )
  );
}

function stripPerplexityUIArtifacts(text: string): string {
  return text
    .replace(/show more\s*show less/gi, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || isPerplexityUiArtifact(line)) return false;
      if (/^(sources?|related|thread|library|discover|share|rewrite)$/i.test(line)) return false;
      return true;
    })
    .join("\n");
}

function structuredBodyFromPerplexitySurface(text: string): string {
  const stripped = stripPerplexityUIArtifacts(text);
  const durableMarker = stripped.search(
    /(?:^|\n)\s*(?:objective|trusted state|stable core|hard requirements?|requirements?|governance principles?|invariants?|continuity safeguards?|rejected directions?|open questions?|open\s*\/\s*unresolved|carry[-\s]?forward capsule)\s*:/i
  );
  if (durableMarker >= 0) {
    return stripped.slice(durableMarker).trim();
  }
  return stripped.trim();
}

function normalizeDeepSeekGovernanceBlocks(text: string): string {
  return text
    .replace(/([.!?])\s*([A-Z]\d+)([A-Z][a-z])/g, "$1\n$2 $3")
    .replace(/([a-z)])([A-Z]\d+)([A-Z][a-z])/g, "$1\n$2 $3")
    .replace(/([A-Z]\d+)([A-Z][a-z])/g, "$1 $2")
    .replace(
      /(^|\n)\s*(trusted state|untrusted instructions|quarantine log|deferred items|deferred item|conditional admissions|conditional admission|rejected directions|rejected direction|governance principles|governance principle|invariants|invariant|continuity safeguards|continuity safeguard|mutation targets|mutation target|mutation risk)\b\s*:?/gi,
      "\n$2:"
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function prepareProviderSource(text: string, request: TransformRequest): string {
  const id = providerId(request);
  let prepared = text;
  if (id === "deepseek") {
    prepared = normalizeDeepSeekGovernanceBlocks(prepared);
  }
  if (id === "perplexity") {
    prepared = structuredBodyFromPerplexitySurface(prepared);
  }
  return normalizeRuntimeScaffold(prepared);
}

function isDefaultContinuityInstructionLine(text: string): boolean {
  const cleaned = cleanStateLine(text);
  return (
    /^keep the stable core intact unless the user explicitly changes it\.?$/i.test(cleaned) ||
    /^reduce repetition and keep the response anchored to the active objective\.?$/i.test(
      cleaned
    ) ||
    /^keep unresolved questions visible instead of silently resolving or dropping them\.?$/i.test(
      cleaned
    )
  );
}

function removeGeneratedRuntimeInstructions(text: string): string {
  return normalizeRuntimeScaffold(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^continuity instructions:?$/i.test(line) &&
        !isDefaultContinuityInstructionLine(line)
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isRuntimeScaffoldLine(text: string): boolean {
  return (
    !text.trim() ||
    /^(stable core|new\s*\/\s*provisional|open\s*\/\s*unresolved|what changed|recommended next actions|continuity instructions):?$/i.test(
      text.trim()
    ) ||
    isDefaultContinuityInstructionLine(text)
  );
}

function statementsFromText(text: string): string[] {
  const prepared = removeGeneratedRuntimeInstructions(text);
  return uniqueMeaningfulStrings(
    prepared
      .replace(
        /\s+(requirements?|hard requirements?|output contract|context|open questions?):\s*/gi,
        "\n$1:\n"
      )
      .replace(/\s+[-*•]\s+/g, "\n- ")
      .split(/\n|(?<=[.!?])\s+/)
      .map((line) => stripSectionLabel(line).trim())
      .filter(
        (line) =>
          line.length > 3 &&
          !/^carry[-\s]?forward capsule:?$/i.test(line) &&
          !isRuntimeScaffoldLine(line)
      )
  ).slice(0, 12);
}

function hasRetrievalGovernance(request: TransformRequest): boolean {
  const profile = request.providerProfile;
  return (
    profile?.retrieved_content_default_state === "provisional_or_quarantine" ||
    /source_contamination|retrieval/i.test(
      `${profile?.capsule_bias ?? ""} ${profile?.continuity_style ?? ""}`
    )
  );
}

function isRetrievalContextLine(text: string): boolean {
  return /^(retrieved evidence|retrieval context|retrieved context|external evidence|source|sources|citation|citations|web result|search result)\b/i.test(
    cleanStateLine(text)
  );
}

function retrievalTextFromLine(text: string): string {
  return cleanStateLine(
    text.replace(
      /^\s*[-*•]?\s*(retrieved evidence|retrieval context|retrieved context|external evidence|source|sources|citation|citations|web result|search result)(?:\s*\([^)]*\))?\s*:\s*/i,
      ""
    )
  );
}

function applyRetrievalGovernance(
  text: string,
  request: TransformRequest
): { continuityText: string; retrievalContext: string[] } {
  if (!hasRetrievalGovernance(request)) {
    return { continuityText: text, retrievalContext: [] };
  }

  const retrievalContext: string[] = [];
  const continuityLines: string[] = [];

  for (const line of normalizeRuntimeScaffold(text).split("\n")) {
    const trimmed = line.trim();
    if (isRetrievalContextLine(trimmed)) {
      const retrievalText = retrievalTextFromLine(trimmed);
      if (retrievalText) {
        retrievalContext.push(retrievalText);
      }
      continue;
    }
    continuityLines.push(line);
  }

  return {
    continuityText: continuityLines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    retrievalContext: uniqueMeaningfulStrings(retrievalContext).slice(0, 8)
  };
}

function normalizeCanonicalText(text: string): string {
  return cleanStateLine(text)
    .replace(SPEAKER_PREFIX_RE, "")
    .replace(/^\s*(?:[-*•>]+\s*)+/, "")
    .replace(/^\s*(?:[IVXLCDM]+\.|\d+[.)]|[A-Z]\d+|[A-Z]\.)\s*/i, "")
    .replace(
      /^\s*(?:trusted state|trusted_state|stable state|stable core|untrusted instructions|untrusted_instructions|conflicting instructions|quarantine log|quarantine_log|quarantine|quarantined item|deferred items|deferred item|deferred_items|defer|conditional admissions|conditional admission|conditional_admissions|conditional admit|rejected directions|rejected direction|rejected_directions|rejections|governance principles|governance principle|governance_principles|invariants|invariant|continuity safeguards|continuity safeguard|continuity_safeguards|mutation targets|mutation target|mutation risk|task local instructions|task-local instructions|task_local_instructions|task local forbidden|task-local forbidden|task_local_forbidden|open unresolved|open\/unresolved|new provisional|new\/provisional|admitted updates|requirement|constraint|decision|risk|note|objective|open question):\s*/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalId(text: string, bucket: ContinuityPrimaryBucket): string {
  const key = normalizeCanonicalText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 44);
  return `item_${bucket}_${key || "state"}`;
}

function sectionBucket(label: string): ContinuityPrimaryBucket | null {
  const normalized = label
    .toLowerCase()
    .replace(/[_\s/]+/g, " ")
    .trim();
  if (/trusted state|stable state|stable core|objective/.test(normalized)) return "stable_core";
  if (/untrusted|conflicting/.test(normalized)) return "quarantine_log";
  if (/quarantine/.test(normalized)) return "quarantine_log";
  if (/defer|deferred/.test(normalized)) return "deferred_items";
  if (/conditional/.test(normalized)) return "conditional_admissions";
  if (/reject|rejection/.test(normalized)) return "rejected_directions";
  if (/governance/.test(normalized)) return "governance_principles";
  if (/invariant/.test(normalized)) return "invariants";
  if (/safeguard/.test(normalized)) return "continuity_safeguards";
  if (/mutation/.test(normalized)) return "mutation_targets";
  if (/task local forbidden/.test(normalized)) return "task_local_forbidden";
  if (/task local instructions/.test(normalized)) return "task_local_instructions";
  if (/open/.test(normalized)) return "open_unresolved";
  if (/provisional|new/.test(normalized)) return "provisional_state";
  if (/admitted/.test(normalized)) return "provisional_state";
  return null;
}

function sourceRoleForStatement(rawText: string, source: string): ContinuitySourceRole {
  const lowerSource = source.toLowerCase();
  const raw = rawText.trim();
  if (lowerSource.includes("retrieval")) return "retrieved_external";
  if (lowerSource.includes("trusted_state")) return "trusted_state";
  if (lowerSource.includes("capsule")) return "user_quoted_prior_state";
  if (isPerplexityUiArtifact(raw)) return "page_chrome";
  if (/^\s*(assistant|model|ai)\s*:/i.test(raw)) return "assistant_generated";
  if (/^\s*(system|developer)\s*:/i.test(raw)) return "system_ui";
  if (
    /\b(?:assistant|model|gemini|claude|chatgpt|grok|deepseek|perplexity)\s+(?:said|responded|wrote|answered)\b/i.test(
      raw
    )
  ) {
    return "external_model_output";
  }
  if (/^\s*user\s*:/i.test(raw)) return "user_authored";
  if (lowerSource.includes("continuity_review")) return "trusted_state";
  if (lowerSource === "draft" || lowerSource === "manual") return "user_authored";
  return "unknown";
}

function isPromotedByUser(text: string, sourceRole: ContinuitySourceRole): boolean {
  if (sourceRole === "trusted_state" || sourceRole === "user_quoted_prior_state") return true;
  return ADOPTION_RE.test(text);
}

function isTaskLocalInstruction(text: string): boolean {
  const clean = normalizeCanonicalText(text);
  if (!clean) return false;
  const durableSignals =
    /\b(durable|stable|governance|invariant|continuity|carry[-\s]?forward|trusted state|must not do again|rejected direction)\b/i.test(
      clean
    );
  if (durableSignals) return false;
  return TASK_LOCAL_RE.test(clean);
}

function isPromptScaffold(text: string): boolean {
  const clean = normalizeCanonicalText(text);
  if (!clean) return false;
  return (
    PROMPT_SCAFFOLD_RE.test(clean) ||
    /^(stage|step|phase)\s+\d+\b/i.test(clean) ||
    /^(final scores?|reconstruction confidence score|structured response)$/i.test(clean)
  );
}

function isCategoryHeader(text: string): boolean {
  return (
    Boolean(text.trim().match(SECTION_LABEL_RE)) ||
    /^(mission|invariants|failure modes|tensions and tradeoffs|governance principles|stable core|rejected directions)$/i.test(
      text.trim()
    )
  );
}

function splitGovernanceStatements(
  text: string,
  source: string
): Array<{
  text: string;
  source: string;
  sourceRole: ContinuitySourceRole;
  sectionBucket?: ContinuityPrimaryBucket;
}> {
  if (!text.trim()) return [];
  const prepared = normalizeRuntimeScaffold(text)
    .replace(/\r/g, "\n")
    .replace(/\s+([-*•]\s+)/g, "\n$1")
    .replace(/\s+((?:[IVXLCDM]+|\d+)\.\s+[A-Z])/g, "\n$1")
    .replace(/\s+([A-Z]\d+\s+[A-Z])/g, "\n$1");
  const output: Array<{
    text: string;
    source: string;
    sourceRole: ContinuitySourceRole;
    sectionBucket?: ContinuityPrimaryBucket;
  }> = [];
  let currentBucket: ContinuityPrimaryBucket | undefined;

  for (const rawLine of prepared.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const labelMatch = line.match(SECTION_LABEL_RE);
    if (labelMatch) {
      const bucket = sectionBucket(labelMatch[1] ?? "");
      if (bucket) currentBucket = bucket;
      const remainder = normalizeCanonicalText(labelMatch[2] ?? "");
      if (!remainder) continue;
      output.push({
        text: remainder,
        source,
        sourceRole: sourceRoleForStatement(rawLine, source),
        sectionBucket: bucket ?? currentBucket
      });
      continue;
    }

    const pieces =
      line.length > 260
        ? line
            .split(/(?<=[.!?])\s+(?=[A-Z])/)
            .map(normalizeCanonicalText)
            .filter(Boolean)
        : [normalizeCanonicalText(line)].filter(Boolean);
    output.push(
      ...pieces.map((item) => ({
        text: item,
        source,
        sourceRole: sourceRoleForStatement(rawLine, source),
        sectionBucket: currentBucket
      }))
    );
  }

  return output.filter((item) => item.text.length > 3);
}

function uniqueCanonicalItems(items: string[]): string[] {
  return uniqueMeaningfulStrings(items.map(normalizeCanonicalText).filter(Boolean));
}

function isStrictRejectedDirection(text: string): boolean {
  const clean = normalizeCanonicalText(text);
  if (!clean) return false;
  if (/^no silent transitions\.?$/i.test(clean)) return false;
  if (/^(governance priority|audit necessity|identity anchoring)\b/i.test(clean)) return false;
  return (
    STRICT_REJECT_RE.test(clean) ||
    /^no\s+(generic|automatic|untrusted|unsupported|raw json|fake|forced)\b/i.test(clean)
  );
}

function bucketForGovernanceStatement(
  text: string,
  section: ContinuityPrimaryBucket | undefined,
  sourceRole: ContinuitySourceRole
): {
  bucket: ContinuityPrimaryBucket;
  decision: CanonicalContinuityItem["decision"];
  reason: string;
} {
  if (sourceRole === "page_chrome" || sourceRole === "system_ui" || sourceRole === "extension_ui") {
    return {
      bucket: "diagnostic_only",
      decision: "quarantine",
      reason: "UI or system chrome is not continuity state"
    };
  }
  if (
    (sourceRole === "assistant_generated" ||
      sourceRole === "external_model_output" ||
      sourceRole === "retrieved_external") &&
    !isPromotedByUser(text, sourceRole)
  ) {
    return {
      bucket: "quarantine_log",
      decision: "quarantine",
      reason: `${sourceRole.replace(/_/g, " ")} requires explicit user promotion before admission`
    };
  }
  if (isPromptScaffold(text)) {
    return {
      bucket: "diagnostic_only",
      decision: "quarantine",
      reason: "prompt scaffolding is diagnostic only"
    };
  }
  if (section === "task_local_instructions" || isTaskLocalInstruction(text)) {
    return {
      bucket: "task_local_instructions",
      decision: "defer",
      reason: "task-local answer instruction, not durable state"
    };
  }
  if (section === "task_local_forbidden") {
    return {
      bucket: "task_local_forbidden",
      decision: "defer",
      reason: "task-local forbidden instruction, not durable rejection"
    };
  }
  if (section === "stable_core") {
    return { bucket: "stable_core", decision: "admit", reason: "trusted stable state" };
  }
  if (section === "governance_principles") {
    return { bucket: "governance_principles", decision: "admit", reason: "governance principle" };
  }
  if (section === "invariants") {
    return { bucket: "invariants", decision: "admit", reason: "durable invariant" };
  }
  if (section === "continuity_safeguards") {
    return { bucket: "continuity_safeguards", decision: "admit", reason: "continuity safeguard" };
  }
  if (section === "deferred_items") {
    return { bucket: "deferred_items", decision: "defer", reason: "requires later validation" };
  }
  if (section === "conditional_admissions") {
    return {
      bucket: "conditional_admissions",
      decision: "conditional_admit",
      reason: "admissible only under stated conditions"
    };
  }
  if (section === "rejected_directions") {
    if (isStrictRejectedDirection(text)) {
      return {
        bucket: "rejected_directions",
        decision: "reject",
        reason: "explicitly forbidden direction"
      };
    }
    return {
      bucket: "task_local_forbidden",
      decision: "defer",
      reason: "negative or labeled text was not a durable rejected direction"
    };
  }
  if (section === "quarantine_log") {
    return {
      bucket: "quarantine_log",
      decision: "quarantine",
      reason: "untrusted or retrieval context is analysis-only"
    };
  }
  if (
    /^(retrieved evidence|retrieval context|retrieved context|external evidence|source|sources|citation|citations|web result|search result)\b/i.test(
      text
    )
  ) {
    return {
      bucket: "quarantine_log",
      decision: "quarantine",
      reason: "retrieved context is analysis-only until admitted"
    };
  }
  if (section === "mutation_targets" || MUTATION_RE.test(text)) {
    return {
      bucket: "mutation_targets",
      decision: "quarantine",
      reason: "mutation risk preserved for analysis"
    };
  }
  if (QUARANTINE_RE.test(text) || UNTRUSTED_RE.test(text)) {
    if (
      isStrictRejectedDirection(text) ||
      /\b(ignore previous|replace trusted|delete safeguards|discard trusted)\b/i.test(text)
    ) {
      return {
        bucket: "rejected_directions",
        decision: "reject",
        reason: "conflicts with trusted state"
      };
    }
    return {
      bucket: "quarantine_log",
      decision: "quarantine",
      reason: "untrusted or retrieval context is analysis-only"
    };
  }
  if (DEFER_RE.test(text)) {
    return { bucket: "deferred_items", decision: "defer", reason: "requires later validation" };
  }
  if (CONDITIONAL_ADMIT_RE.test(text)) {
    return {
      bucket: "conditional_admissions",
      decision: "conditional_admit",
      reason: "admissible only under stated conditions"
    };
  }
  if (isStrictRejectedDirection(text)) {
    return {
      bucket: "rejected_directions",
      decision: "reject",
      reason: "explicitly forbidden direction"
    };
  }
  if (INVARIANT_RE.test(text)) {
    return { bucket: "invariants", decision: "admit", reason: "durable invariant" };
  }
  if (CONTINUITY_SAFEGUARD_RE.test(text)) {
    return { bucket: "continuity_safeguards", decision: "admit", reason: "continuity safeguard" };
  }
  if (GOVERNANCE_PRINCIPLE_RE.test(text)) {
    return { bucket: "governance_principles", decision: "admit", reason: "governance principle" };
  }
  if (
    section === "open_unresolved" ||
    /\?|open question|unresolved|unclear|risk|tension|unknown/i.test(text)
  ) {
    return { bucket: "open_unresolved", decision: "defer", reason: "open or unresolved state" };
  }
  return { bucket: "provisional_state", decision: "admit", reason: "new admissible update" };
}

function makeCanonicalItem(
  text: string,
  bucket: ContinuityPrimaryBucket,
  decision: CanonicalContinuityItem["decision"],
  source: string,
  sourceRole: ContinuitySourceRole,
  reason: string,
  crossRefs: ContinuityPrimaryBucket[] = []
): CanonicalContinuityItem {
  return {
    id: canonicalId(text, bucket),
    text: normalizeCanonicalText(text),
    primary_bucket: bucket,
    decision,
    source,
    source_role: sourceRole,
    reason,
    cross_refs: crossRefs.length ? crossRefs : undefined
  };
}

function addUniqueItem(items: CanonicalContinuityItem[], item: CanonicalContinuityItem): void {
  if (!item.text) return;
  const existing = items.find((candidate) =>
    isMeaningfullyDuplicate(candidate.text, item.text, 0.78)
  );
  if (!existing) {
    items.push(item);
    return;
  }
  if (
    !existing.cross_refs?.includes(item.primary_bucket) &&
    existing.primary_bucket !== item.primary_bucket
  ) {
    existing.cross_refs = [...(existing.cross_refs ?? []), item.primary_bucket];
  }
}

function mutationTargetFromText(text: string): MutationTarget {
  const clean = normalizeCanonicalText(text);
  let target = "trusted_state";
  if (/\bmission|objective\b/i.test(clean)) target = "mission";
  if (/\bconstraint|safeguard|invariant\b/i.test(clean)) target = "safeguards";
  if (/\baudit|diagnostic|visibility\b/i.test(clean)) target = "audit_visibility";
  if (/\bopen|unresolved|tension\b/i.test(clean)) target = "unresolved_state";
  const critical =
    /\b(ignore previous|replace trusted|delete safeguards|suppress audit|false claim|hidden rewrite|override)\b/i.test(
      clean
    );
  return {
    target_component: target,
    attempted_mutation: clean,
    risk_level: critical ? "critical" : "high",
    applied: false,
    reason: "Conflicts with trusted continuity governance."
  };
}

function trustedSummaryFrom(
  activeObjective: string,
  stableCore: string[],
  parsed: ParsedCapsuleState | undefined
): string[] {
  return uniqueCanonicalItems([
    activeObjective ? `Objective: ${activeObjective}` : "",
    ...(parsed?.stable_constraints ?? []),
    ...(parsed?.accepted_decisions ?? []),
    ...stableCore
  ]).slice(0, 12);
}

function buildAdversarialGovernanceState(input: {
  activeObjective: string;
  stableCore: string[];
  newProvisional: string[];
  openUnresolved: string[];
  parsed?: ParsedCapsuleState;
  request: TransformRequest;
  sourceText: string;
  newInstructionText: string;
  retrievalContext: string[];
}): AdversarialGovernanceState {
  const canonicalItems: CanonicalContinuityItem[] = [];
  const trustedStable = trustedSummaryFrom(input.activeObjective, input.stableCore, input.parsed);

  for (const item of trustedStable) {
    addUniqueItem(
      canonicalItems,
      makeCanonicalItem(
        item,
        "stable_core",
        "admit",
        "trusted_state",
        "trusted_state",
        "accepted durable state"
      )
    );
  }
  for (const item of input.openUnresolved) {
    addUniqueItem(
      canonicalItems,
      makeCanonicalItem(
        item,
        "open_unresolved",
        "defer",
        "continuity_review.open_unresolved",
        "trusted_state",
        "open state is preserved"
      )
    );
  }

  const statements = [
    ...splitGovernanceStatements(input.newInstructionText || input.sourceText, "draft"),
    ...input.newProvisional.flatMap((item) =>
      splitGovernanceStatements(item, "continuity_review.new_provisional")
    ),
    ...input.retrievalContext.flatMap((item) =>
      splitGovernanceStatements(`Retrieved evidence: ${item}`, "retrieval_context")
    )
  ];

  for (const statement of statements) {
    const classification = bucketForGovernanceStatement(
      statement.text,
      statement.sectionBucket,
      statement.sourceRole
    );
    const crossRefs: ContinuityPrimaryBucket[] = [];
    if (
      classification.bucket !== "rejected_directions" &&
      classification.bucket !== "task_local_forbidden" &&
      isStrictRejectedDirection(statement.text)
    ) {
      crossRefs.push("rejected_directions");
    }
    if (
      classification.bucket !== "governance_principles" &&
      GOVERNANCE_PRINCIPLE_RE.test(statement.text)
    ) {
      crossRefs.push("governance_principles");
    }
    addUniqueItem(
      canonicalItems,
      makeCanonicalItem(
        statement.text,
        classification.bucket,
        classification.decision,
        statement.source,
        statement.sourceRole,
        classification.reason,
        crossRefs
      )
    );
  }

  const byBucket = (bucket: ContinuityPrimaryBucket): CanonicalContinuityItem[] =>
    canonicalItems.filter((item) => item.primary_bucket === bucket);
  const governancePrinciples = uniqueCanonicalItems(
    byBucket("governance_principles").map((item) => item.text)
  );
  const invariants = uniqueCanonicalItems(byBucket("invariants").map((item) => item.text));
  const continuitySafeguards = uniqueCanonicalItems(
    byBucket("continuity_safeguards").map((item) => item.text)
  );
  const rejectedDirections = uniqueCanonicalItems(
    canonicalItems
      .filter(
        (item) =>
          item.primary_bucket === "rejected_directions" ||
          item.cross_refs?.includes("rejected_directions")
      )
      .map((item) => item.text)
      .filter(isStrictRejectedDirection)
  );
  const quarantineLog = uniqueCanonicalItems(
    canonicalItems
      .filter(
        (item) =>
          item.primary_bucket === "quarantine_log" || item.cross_refs?.includes("quarantine_log")
      )
      .map((item) => item.text)
  );
  const deferredItems = byBucket("deferred_items");
  const conditionalAdmissions = byBucket("conditional_admissions");
  const taskLocalInstructions = byBucket("task_local_instructions");
  const taskLocalForbidden = byBucket("task_local_forbidden");
  const rejectedItems = byBucket("rejected_directions");
  const quarantinedItems = canonicalItems.filter(
    (item) =>
      item.primary_bucket === "quarantine_log" ||
      item.primary_bucket === "diagnostic_only" ||
      item.cross_refs?.includes("quarantine_log")
  );
  const untrustedInstructions = canonicalItems.filter(
    (item) =>
      item.decision === "reject" ||
      item.decision === "quarantine" ||
      item.primary_bucket === "mutation_targets" ||
      item.primary_bucket === "quarantine_log" ||
      item.source_role === "assistant_generated" ||
      item.source_role === "external_model_output" ||
      item.source_role === "retrieved_external"
  );
  const mutationTargets = uniqueCanonicalItems([
    ...byBucket("mutation_targets").map((item) => item.text),
    ...untrustedInstructions.filter((item) => MUTATION_RE.test(item.text)).map((item) => item.text)
  ]).map(mutationTargetFromText);
  const admittedUpdates = canonicalItems.filter(
    (item) => item.primary_bucket === "provisional_state" && item.decision === "admit"
  );
  const conflictWarnings: string[] = [];
  if (untrustedInstructions.length && trustedStable.length) {
    conflictWarnings.push("Conflicting or untrusted instructions were kept out of trusted state.");
  }
  if (input.retrievalContext.length) {
    conflictWarnings.push("Retrieved context remains provisional or quarantined until admitted.");
  }

  const metricWarnings: string[] = [];
  if (
    /(untrusted|ignore previous|override|conflict|adversarial)/i.test(input.sourceText) &&
    !untrustedInstructions.length
  ) {
    metricWarnings.push("Metric penalty applied due to weak trusted/untrusted separation.");
  }
  if (
    /(show more|show less|user:|assistant:)/i.test(
      canonicalItems.map((item) => item.text).join("\n")
    )
  ) {
    metricWarnings.push("Metric penalty applied due to field contamination.");
  }
  if (
    byBucket("stable_core").some(
      (item) =>
        item.source_role === "assistant_generated" || item.source_role === "external_model_output"
    )
  ) {
    metricWarnings.push("Metric penalty applied due to assistant-authored state contamination.");
  }
  if (
    canonicalItems.some(
      (item) => item.source_role === "page_chrome" || isPerplexityUiArtifact(item.text)
    )
  ) {
    metricWarnings.push("Metric penalty applied due to page chrome contamination.");
  }
  if (
    byBucket("stable_core").some(
      (item) => isTaskLocalInstruction(item.text) || isPromptScaffold(item.text)
    )
  ) {
    metricWarnings.push(
      "Metric penalty applied due to task-local or scaffold leakage into stable state."
    );
  }
  if (canonicalItems.some((item) => isCategoryHeader(item.text))) {
    metricWarnings.push("Metric penalty applied due to category header admission.");
  }
  if (
    rejectedItems.some(
      (item) => GOVERNANCE_PRINCIPLE_RE.test(item.text) && !isStrictRejectedDirection(item.text)
    )
  ) {
    metricWarnings.push("Metric penalty applied due to rejected-direction taxonomy ambiguity.");
  }

  return {
    trusted_state: {
      objective: input.activeObjective,
      stable_core: trustedStable,
      governance_principles: governancePrinciples,
      invariants,
      continuity_safeguards: continuitySafeguards
    },
    untrusted_instructions: untrustedInstructions,
    quarantined_items: quarantinedItems,
    deferred_items: deferredItems,
    rejected_items: rejectedItems,
    admitted_updates: admittedUpdates,
    conditional_admissions: conditionalAdmissions,
    task_local_instructions: taskLocalInstructions,
    task_local_forbidden: taskLocalForbidden,
    governance_principles: governancePrinciples,
    invariants,
    continuity_safeguards: continuitySafeguards,
    rejected_directions: rejectedDirections,
    quarantine_log: quarantineLog,
    mutation_targets: mutationTargets,
    conflict_report: {
      has_conflict: untrustedInstructions.length > 0,
      trusted_summary: trustedStable.slice(0, 8),
      untrusted_summary: untrustedInstructions.map((item) => item.text).slice(0, 8),
      conflicts: untrustedInstructions
        .filter((item) => item.decision === "reject")
        .map((item) => item.text)
        .slice(0, 8),
      warnings: conflictWarnings
    },
    mutation_risk_report: {
      mutation_targets: mutationTargets,
      summary: mutationTargets.length
        ? `${mutationTargets.length} attempted mutation target(s) preserved without applying them.`
        : undefined,
      overall_attack_type: mutationTargets.length ? "trusted-state mutation attempt" : undefined
    },
    canonical_items: canonicalItems.slice(0, 80),
    metric_warnings: metricWarnings
  };
}

function isCoveredBy(existing: string[], candidate: string): boolean {
  return existing.some((item) => isMeaningfullyDuplicate(item, candidate, 0.72));
}

function isDurableStableCandidate(text: string): boolean {
  const clean = normalizeCanonicalText(text);
  if (
    !clean ||
    isPerplexityUiArtifact(clean) ||
    isPromptScaffold(clean) ||
    isTaskLocalInstruction(clean)
  ) {
    return false;
  }
  if (/^\s*(?:assistant|model|ai|system|developer)\s*:/i.test(text)) return false;
  if (
    /\b(format|table|markdown|json|schema|bullet|section|score|final scores?|respond with|return as)\b/i.test(
      clean
    )
  ) {
    return /\b(durable|stable|governance|invariant|continuity|trusted state|must remain)\b/i.test(
      clean
    );
  }
  return true;
}

function objectiveFromText(text: string, fallback = "Continue the active workflow."): string {
  const prepared = removeGeneratedRuntimeInstructions(text);
  const objectiveMatch = prepared.match(/(?:^|\n)\s*(?:[-*•]\s*)?objective:\s*([^\n]*)/i);
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
  retrievalContext: string[];
}): ContinuityReview {
  const parsed = input.parsedCapsuleResult?.parsedCapsule;
  const newInstructionText = input.parsedCapsuleResult?.sourceWithoutCapsule ?? input.sourceText;
  const activeObjective =
    parsed?.active_objective ?? objectiveFromText(input.normalized || input.reduced);
  const hardConstraints = input.constraints
    .filter((constraint) => constraint.hard)
    .map((constraint) => constraint.text)
    .filter(isDurableStableCandidate);
  const stableCore = uniqueMeaningfulStrings([
    ...hardConstraints,
    ...(parsed?.stable_constraints.filter(isDurableStableCandidate) ?? []),
    ...(parsed?.accepted_decisions
      .map((item) => `Decision: ${item}`)
      .filter(isDurableStableCandidate) ?? [])
  ]).filter((item) => !isMeaningfullyDuplicate(item, activeObjective, 0.78));
  const openUnresolved = uniqueMeaningfulStrings([
    ...(parsed?.open_questions ?? []),
    ...(parsed?.unresolved_risks.map((item) => `Risk: ${item}`) ?? []),
    ...statementsFromText(newInstructionText).filter(
      (item) =>
        !isRetrievalContextLine(item) &&
        /\?|open question|unclear|unknown|risk|unresolved|needs confirmation/i.test(item)
    )
  ]);
  const stableAndOpen = [activeObjective, ...stableCore, ...openUnresolved];
  const retrievedProvisional = input.retrievalContext.map(
    (item) => `Retrieved evidence (Provisional): ${item}`
  );
  const newProvisional = uniqueMeaningfulStrings([
    ...retrievedProvisional,
    ...statementsFromText(newInstructionText)
      .filter((item) => !isRetrievalContextLine(item))
      .filter((item) => !isCoveredBy(stableAndOpen, item))
      .filter((item) => !/^no new/i.test(item))
  ]).slice(0, 8);
  const governanceState = buildAdversarialGovernanceState({
    activeObjective,
    stableCore,
    newProvisional,
    openUnresolved,
    parsed,
    request: input.request,
    sourceText: input.sourceText,
    newInstructionText,
    retrievalContext: input.retrievalContext
  });
  const whatChanged = uniqueMeaningfulStrings([
    parsed
      ? "Parsed the carry-forward capsule into human-readable continuity state."
      : "Parsed the current draft into continuity state.",
    "Reduced redundant wording and repeated requirements.",
    "Prioritized the active objective as the default runtime behavior.",
    newProvisional.length ? "Separated new or provisional instructions from stable state." : "",
    openUnresolved.length ? "Kept open or unresolved items visible." : "",
    input.retrievalContext.length ? "Kept retrieved source material out of Stable Core." : "",
    governanceState.conflict_report.has_conflict
      ? "Separated trusted state from untrusted or conflicting instructions."
      : "",
    governanceState.mutation_targets.length
      ? "Preserved mutation risk analysis without applying attempted state changes."
      : "",
    input.request.providerProfile
      ? `Attached ${input.request.providerProfile.provider} continuity profile diagnostics.`
      : ""
  ]);
  const providerEmphasis = input.request.providerProfile?.recommended_runtime_emphasis ?? [];
  const recommendedNextActions = uniqueMeaningfulStrings([
    newProvisional.length
      ? "Review the New / Provisional items before treating them as stable."
      : "",
    openUnresolved.length
      ? "Resolve, answer, or deliberately carry forward the Open / Unresolved items."
      : "",
    parsed?.explicit_next_actions.length ? parsed.explicit_next_actions.join("; ") : "",
    input.retrievalContext.length
      ? "Treat retrieved evidence as Provisional or Quarantine until continuity governance explicitly admits it."
      : "",
    governanceState.rejected_directions.length
      ? "Keep rejected directions separate from governance principles and invariants."
      : "",
    governanceState.quarantine_log.length
      ? "Use quarantined material for analysis only unless explicitly admitted later."
      : "",
    ...providerEmphasis.slice(0, 2),
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
      targetModel: input.request.targetModel,
      providerProfile: input.request.providerProfile,
      providerHealth: input.request.providerHealth,
      retrievalContext: input.retrievalContext.length ? input.retrievalContext : undefined,
      adversarialGovernance: governanceState,
      trusted_state_summary: governanceState.conflict_report.trusted_summary,
      untrusted_instruction_summary: governanceState.conflict_report.untrusted_summary,
      task_local_instructions: governanceState.task_local_instructions.map((item) => item.text),
      task_local_forbidden: governanceState.task_local_forbidden.map((item) => item.text),
      rejected_items: governanceState.rejected_items.map((item) => item.text),
      quarantined_items: governanceState.quarantined_items.map((item) => item.text),
      deferred_items: governanceState.deferred_items.map((item) => item.text),
      conditional_admissions: governanceState.conditional_admissions.map((item) => item.text),
      mutation_risk_report: governanceState.mutation_risk_report,
      governance_principles: governanceState.governance_principles,
      invariants: governanceState.invariants,
      continuity_safeguards: governanceState.continuity_safeguards,
      metric_warnings: governanceState.metric_warnings
    }
  };
}

function buildFinalHandoff(review: ContinuityReview): string {
  const governance = review.diagnostics.adversarialGovernance;
  const mutationRisk =
    governance?.mutation_targets.map(
      (item) =>
        `${item.target_component}: ${item.attempted_mutation} (${item.risk_level}, applied: ${item.applied ? "yes" : "no"})`
    ) ?? [];
  const chunks = [
    `Objective: ${review.activeObjective}`,
    section("Stable Core", review.stableCore),
    section("New / Provisional", review.newProvisional),
    section("Open / Unresolved", review.openUnresolved),
    section("Governance Principles", governance?.governance_principles ?? []),
    section("Invariants", governance?.invariants ?? []),
    section("Continuity Safeguards", governance?.continuity_safeguards ?? []),
    section(
      "Task Local Instructions",
      governance?.task_local_instructions.map((item) => item.text) ?? []
    ),
    section(
      "Task Local Forbidden",
      governance?.task_local_forbidden.map((item) => item.text) ?? []
    ),
    section("Rejected Directions", governance?.rejected_directions ?? []),
    section("Quarantine Log", governance?.quarantine_log ?? []),
    section("Deferred Items", governance?.deferred_items.map((item) => item.text) ?? []),
    section(
      "Conditional Admissions",
      governance?.conditional_admissions.map((item) => item.text) ?? []
    ),
    section("Mutation Risk", mutationRisk),
    section("Continuity Instructions", [
      "Keep the stable core intact unless the user explicitly changes it.",
      "Reduce repetition and keep the response anchored to the active objective.",
      "Keep unresolved questions visible instead of silently resolving or dropping them."
    ])
  ].filter(Boolean);
  return chunks.join("\n\n").trim();
}

function hasBucketOverlap(review: ContinuityReview): boolean {
  const buckets = [
    review.stableCore,
    review.newProvisional,
    review.openUnresolved,
    review.diagnostics.adversarialGovernance?.rejected_directions ?? [],
    review.diagnostics.adversarialGovernance?.quarantine_log ?? [],
    review.diagnostics.adversarialGovernance?.deferred_items.map((item) => item.text) ?? []
  ];
  for (let leftIndex = 0; leftIndex < buckets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < buckets.length; rightIndex += 1) {
      if (
        buckets[leftIndex].some((left) =>
          buckets[rightIndex].some((right) => isMeaningfullyDuplicate(left, right, 0.86))
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function metricPenaltiesForReview(
  request: TransformRequest,
  review: ContinuityReview
): NonNullable<Parameters<typeof computeTransformationScores>[0]["penalties"]> {
  const governance = review.diagnostics.adversarialGovernance;
  const reviewText = [
    review.activeObjective,
    ...review.stableCore,
    ...review.newProvisional,
    ...review.openUnresolved,
    ...(governance?.rejected_directions ?? [])
  ].join("\n");
  const hasConflictSignal =
    /(untrusted|ignore previous|override|conflicting instruction|adversarial|replace trusted|discard trusted)/i.test(
      request.sourceText
    );
  const hasOpenSignal = /\?|open question|unresolved|unclear|risk|tension|unknown/i.test(
    request.sourceText
  );
  const hasMutationSignal = MUTATION_RE.test(request.sourceText);
  const hasStructuredStateSignal =
    request.sourceText.length > 240 &&
    /\b(objective|stable core|trusted state|governance principles?|invariants?|continuity safeguards?|rejected directions?|open questions?)\s*:/i.test(
      request.sourceText
    );
  const hasGovernanceSignal = /\bgovernance principles?\s*:|\bgovernance\b/i.test(
    request.sourceText
  );
  const hasInvariantSignal = /\binvariants?\s*:|\binvariant\b|\bmust remain\b/i.test(
    request.sourceText
  );
  const stableCanonical =
    governance?.canonical_items.filter((item) => item.primary_bucket === "stable_core") ?? [];
  const writebackFailed =
    request.providerHealth?.writeback_status === "failed" ||
    (request.providerHealth?.writeback_attempted === true &&
      request.providerHealth.writeback_success === false);

  return {
    writebackFailed,
    fieldContamination: /(^|\n)\s*(user|assistant)\s*:|show more|show less/i.test(reviewText),
    bucketOverlap: hasBucketOverlap(review),
    rejectedDirectionAmbiguity:
      governance?.rejected_items.some((item) => !isStrictRejectedDirection(item.text)) ?? false,
    weakTrustedSeparation:
      hasConflictSignal &&
      !(
        governance?.untrusted_instructions.length ||
        governance?.rejected_items.length ||
        governance?.quarantined_items.length
      ),
    lostOpenState: hasOpenSignal && review.openUnresolved.length === 0,
    weakObjectiveNormalization:
      review.activeObjective.length < 18 ||
      /^continue the active workflow\.?$/i.test(review.activeObjective),
    missingMutationHandling: hasMutationSignal && !(governance?.mutation_targets.length ?? 0),
    emptyStateCollapse:
      hasStructuredStateSignal &&
      review.stableCore.length === 0 &&
      !(
        governance?.governance_principles.length ||
        governance?.invariants.length ||
        review.openUnresolved.length
      ),
    chromeContamination:
      /show more|show less|copy link|related questions|ask follow-up/i.test(reviewText) ||
      (governance?.canonical_items.some(
        (item) => item.source_role === "page_chrome" || isPerplexityUiArtifact(item.text)
      ) ??
        false),
    assistantContamination:
      stableCanonical.some(
        (item) =>
          item.source_role === "assistant_generated" || item.source_role === "external_model_output"
      ) || /(^|\n)\s*(assistant|model|ai)\s*:/i.test(review.stableCore.join("\n")),
    promptScaffoldingLeakage: [review.activeObjective, ...review.stableCore].some((item) =>
      isPromptScaffold(item)
    ),
    emptyGovernanceWhenPresent:
      hasGovernanceSignal && !(governance?.governance_principles.length ?? 0),
    emptyInvariantsWhenPresent: hasInvariantSignal && !(governance?.invariants.length ?? 0),
    categoryHeaderAdmission:
      governance?.canonical_items.some((item) => isCategoryHeader(item.text)) ?? false,
    taskLocalLeakage:
      review.stableCore.some((item) => isTaskLocalInstruction(item)) ||
      stableCanonical.some(
        (item) => item.primary_bucket === "stable_core" && isTaskLocalInstruction(item.text)
      )
  };
}

export function transformPrompt(request: TransformRequest): TransformResult {
  const requestProviderId = providerId(request);
  const providerPreparedSource = prepareProviderSource(request.sourceText, request);
  const parsedCapsuleResult = parseCapsuleState(providerPreparedSource);
  const rawContinuitySource = removeGeneratedRuntimeInstructions(
    buildContinuitySource({
      parsedCapsule: parsedCapsuleResult?.parsedCapsule,
      newInstructionText: parsedCapsuleResult?.sourceWithoutCapsule ?? "",
      sourceText: providerPreparedSource
    })
  );
  const governedSource = applyRetrievalGovernance(rawContinuitySource, request);
  const continuitySource =
    governedSource.continuityText ||
    (requestProviderId === "perplexity" &&
    stripPerplexityUIArtifacts(rawContinuitySource).length < 12
      ? ""
      : rawContinuitySource);
  const normalized = normalizePrompt(continuitySource);
  const constraints = extractConstraints(normalized);
  const compressed = compressPrompt(normalized, constraints, {
    ...request,
    sourceText: continuitySource
  });
  const review = buildReview({
    sourceText: providerPreparedSource,
    normalized,
    reduced: compressed,
    constraints,
    parsedCapsuleResult,
    request,
    retrievalContext: governedSource.retrievalContext
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
  const penalties = metricPenaltiesForReview(request, review);
  const scores = computeTransformationScores({
    original: request.sourceText,
    transformed: modelAdjusted,
    constraints,
    targetModel: request.targetModel,
    mode: request.mode,
    penalties
  });
  const metricWarnings = uniqueMeaningfulStrings([
    ...(review.diagnostics.metric_warnings ?? []),
    ...(scores.warnings ?? [])
  ]);
  review.diagnostics.metric_warnings = metricWarnings.length ? metricWarnings : undefined;
  if (review.diagnostics.adversarialGovernance) {
    review.diagnostics.adversarialGovernance.metric_warnings = metricWarnings;
  }

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
