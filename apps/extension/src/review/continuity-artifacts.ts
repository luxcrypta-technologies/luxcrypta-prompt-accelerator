import type { CarryForwardCapsule } from "@/types/capsules";
import type { SessionGovernanceState } from "@/types/governance";
import type { TransformResult } from "@/types/prompts";
import type { Workflow } from "@/types/workflows";
import { isMeaningfullyDuplicate, normalizeMeaning, uniqueMeaningfulStrings } from "@/utils/text";

type WorkflowDraft = Omit<Workflow, "id" | "createdAt" | "updatedAt">;
export type CapsuleDraft = Omit<CarryForwardCapsule, "capsule_version" | "id" | "created_at" | "updated_at">;

export interface ReviewArtifactContext {
  result: TransformResult;
  transformedText: string;
  sessionState: SessionGovernanceState | null;
  extensionVersion: string;
  currentUrl: string;
  workflow?: Workflow | null;
  capsule?: CarryForwardCapsule | null;
  saveStatus?: string;
  exportStatus?: string;
  errorLogs?: string[];
}

const MAX_TITLE_LENGTH = 72;
const MAX_PORTABLE_ITEM_LENGTH = 220;
const MAX_PORTABLE_CONTEXT_ITEMS = 6;
const MAX_CAPSULE_TEXT_ITEMS = 3;

type FragmentClass =
  | "operational_constraint"
  | "accepted_decision"
  | "unresolved_tension"
  | "rejected_direction"
  | "continuity_anchor"
  | "diagnostic_only"
  | "discard";

type AdmissionTarget =
  | "stable_constraints"
  | "accepted_decisions"
  | "unresolved_issues"
  | "rejected_directions"
  | "continuity_anchors"
  | "provisional_state"
  | "workflow_evolution";

interface CandidateInput {
  text?: string;
  source: string;
  preferredClass?: FragmentClass;
}

interface AdmissionContext {
  objectiveHint: string;
  missionText: string;
  diagnosticOnly: string[];
  diagnosticKeys: Set<string>;
  discardedKeys: Set<string>;
  debrisRemoved: number;
  normalizedRejected: number;
  objectiveNormalized?: { from: string; to: string };
  compactedCapsuleText?: { before: number; after: number };
}

interface ClassifiedFragment {
  originalText: string;
  text: string;
  fragmentClass: FragmentClass;
  score: number;
  source: string;
}

interface AdmittedContinuityState {
  activeObjective: string;
  stableConstraints: string[];
  acceptedDecisions: string[];
  unresolvedIssues: string[];
  rejectedDirections: string[];
  continuityAnchors: string[];
  provisionalState: string[];
  workflowEvolution: string[];
  carryForwardContext: string;
  capsuleText: string;
  diagnostics: {
    warnings: string[];
    diagnostic_only_fragments: string[];
    discarded_fragment_count: number;
    debris_removed_count: number;
    normalized_rejected_direction_count: number;
    objective_normalized?: { from: string; to: string };
    capsule_text_compacted?: { before: number; after: number };
  };
}

const OPERATIONAL_RE =
  /\b(continuity|workflow|capsule|diagnostic|save|export|state|runtime|governance|objective|constraint|decision|unresolved|anchor|portable|artifact|review|session|model|extension|toolbar|admission|filter|semantic|carry[-\s]?forward|cognition|prompt accelerator|luxcrypta|stable core|raw json|product|prompt optimization|chat history|review surface|compress|focus)\b/i;
const OPERATIONAL_VERB_RE =
  /\b(preserve|keep|maintain|avoid|exclude|downgrade|quarantine|normalize|distill|dedupe|build|save|export|refine|evaluate|reconstruct|continue|separate|classify|filter|attach|protect|tighten|reduce|implement|route|promote|carry forward)\b/i;
const GOVERNANCE_RE = /\b(governance|stable core|accepted decision|rejected direction|unresolved|open question|risk|continuity invariant|cognition)\b/i;
const CONTINUITY_RE = /\b(continuity|carry[-\s]?forward|reconstruct|workflow identity|session|portable|capsule|anchor)\b/i;
const REJECTED_RE = /\b(do not|don't|never|avoid|forbidden|must not|should not|no\s+\w+|exclude|without)\b/i;
const DECISION_RE = /\b(decision|decided|accepted|approved|we will|chosen|locked|keep\b|use\b|preserve\b)\b/i;
const OPEN_RE = /\?|(?:\b(open question|unclear|unknown|risk|unresolved|needs confirmation|tension|blocked|uncertain|investigate)\b)/i;
const IDENTITY_RE = /\b(luxcrypta|prompt accelerator|continuity runtime|browser extension|workflow identity|operational cognition|save\/export|workflow|capsule|diagnostic)\b/i;

function cleanLine(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function cleanFragmentText(value: string | undefined): string {
  return cleanLine(value)
    .replace(/^```[a-z0-9_-]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*(?:#{1,6}\s*)/, "")
    .replace(/^\s*(?:[-*•>]+\s*)+/, "")
    .replace(/^\s*(?:[IVXLCDM]+\.|\d+[.)]|[A-Z]\.)\s+/i, "")
    .replace(
      /^\s*(?:allowed examples?|bad examples?|new rule|required acceptance criteria|acceptance criteria|observed issues include|main fixes|purpose|target behavior|examples?|instead of preserving):\s*/i,
      ""
    )
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function candidate(text: string | undefined, source: string, preferredClass?: FragmentClass): CandidateInput {
  return { text, source, preferredClass };
}

function candidatesFrom(items: Array<string | undefined>, source: string, preferredClass?: FragmentClass): CandidateInput[] {
  return items.map((item) => candidate(item, source, preferredClass));
}

function uniqueNonEmpty(items: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const clean = cleanLine(item);
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    output.push(clean);
  }
  return output;
}

function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 3).trim()}...`;
}

function truncatePortable(value: string, length = MAX_PORTABLE_ITEM_LENGTH): string {
  const clean = cleanFragmentText(value).replace(/\s*[:;]\s*$/, "");
  if (clean.length <= length) return clean;
  const clipped = clean.slice(0, length - 3);
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf(";"), clipped.lastIndexOf(","));
  const safe = sentenceEnd > 80 ? clipped.slice(0, sentenceEnd) : clipped;
  return `${safe.trim()}...`;
}

export function titleFromObjective(objective: string | undefined, fallback: string): string {
  const clean = cleanLine(objective)
    .replace(/^active objective:\s*/i, "")
    .replace(/^objective:\s*/i, "");
  return truncate(clean || fallback, MAX_TITLE_LENGTH);
}

function bulletSection(title: string, items: string[], emptyText?: string): string[] {
  if (!items.length && !emptyText) return [];
  return [title, ...(items.length ? items.map((item) => `- ${item}`) : [`- ${emptyText}`])];
}

function splitCandidateFragments(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const prepared = value
    .replace(/\r/g, "\n")
    .replace(/^\s*```[a-z0-9_-]*\s*$/gim, "")
    .replace(/^\s*```\s*$/gim, "")
    .replace(/-{6,}/g, "\n")
    .replace(/\s+([-*•]\s+)/g, "\n$1")
    .replace(/\s+((?:[IVXLCDM]+|\d+)\.\s+[A-Z])/g, "\n$1");
  const output: string[] = [];

  for (const line of prepared.split(/\n+/)) {
    const clean = cleanFragmentText(line);
    if (!clean) continue;
    const pieces =
      clean.length > 260
        ? clean
            .split(/(?<=[.!?])\s+(?=[A-Z])/)
            .map(cleanFragmentText)
            .filter(Boolean)
        : [clean];
    output.push(...pieces);
  }

  return output;
}

function isUiArtifact(text: string): boolean {
  const lower = text.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  return (
    /^(showmore|showless|showmoreshowless)$/.test(compact) ||
    /^(apply|copy|save|cancel|close|review|workflow|capsule|downloadjson|saveworkflow|savecapsule|copycapsule|copyrawdiagnosticdata)$/.test(
      compact
    ) ||
    /^(copying|copied|saving workflow|saving capsule|workflow saved|capsule saved|download started)$/.test(lower)
  );
}

function isConversationDebris(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /^(okay|ok|yeah|yep|sure|absolutely|thanks|thank you)[,.! ]*$/.test(lower) ||
    /^okay[,.! ]+\s*i'?m uploading\b/.test(lower) ||
    /^i'?m uploading\b/.test(lower) ||
    /^(just\s+)?stand by[,.! ]*$/.test(lower) ||
    /^hold on\b/.test(lower) ||
    /^this is what i see when i click\b/.test(lower) ||
    /^analy[sz]e everything[.! ]*$/.test(lower) ||
    /^if you want\b/.test(lower) ||
    /^next i can produce\b/.test(lower)
  );
}

function isMetaDirectiveHeading(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /^(codex patch directive|state hygiene \+ semantic admission filtering|primary diagnosis|required admission model|required filtering rules|objective extraction fix|stable constraint filter|rejected direction filter|continuity anchor filter|capsule compactness fix|diagnostic export policy|new admission pipeline|candidate scoring model|required new warnings|required acceptance criteria|testing plan|implementation order|final directive|short note for razak|my take after checking everything|phase \d+)$/.test(
      lower
    ) || /^-{3,}$/.test(lower)
  );
}

function isToolChatter(text: string): boolean {
  return /\b(upload|uploading|click(?:ed)?|browser screenshot|save button|copy button|review window|screenshot workflow)\b/i.test(text);
}

function isScreenshotDebris(text: string): boolean {
  return /\b(product hunt|browser screenshot|store screenshot|screenshot instructions|full[-\s]?page screenshots?|stitched screenshots?|before\/after screenshot|marketing screenshot)\b/i.test(
    text
  );
}

function isScreenshotMissionCritical(context: AdmissionContext): boolean {
  return /\b(screenshot|store listing|product hunt|promo image|marketing asset)\b/i.test(context.objectiveHint);
}

function isQuotedBlockNoise(text: string): boolean {
  return (
    text.length > 360 &&
    /\b(copy[-\s]?paste|directive|instructions?|prompt block|quoted|below is|raw review|transcript)\b/i.test(text)
  );
}

function isOperationallyRelevant(text: string): boolean {
  return OPERATIONAL_RE.test(text) || (OPERATIONAL_VERB_RE.test(text) && text.split(/\s+/).length >= 4);
}

function isIdentityBearing(text: string): boolean {
  return IDENTITY_RE.test(text) && !isUiArtifact(text) && !isConversationDebris(text);
}

function recordDiagnosticOnly(context: AdmissionContext, text: string): void {
  const clean = truncatePortable(text, 180);
  const key = normalizeMeaning(clean);
  if (!key || context.diagnosticKeys.has(key)) return;
  context.diagnosticKeys.add(key);
  context.diagnosticOnly.push(clean);
}

function recordDiscard(context: AdmissionContext, text: string, debris = false): void {
  const key = normalizeMeaning(text);
  if (!key || context.discardedKeys.has(key)) return;
  context.discardedKeys.add(key);
  if (debris) context.debrisRemoved += 1;
}

function scoreFragment(text: string, target: AdmissionTarget, context: AdmissionContext, preferredClass?: FragmentClass): number {
  let score = 0;
  if (isOperationallyRelevant(text)) score += 2;
  if (OPERATIONAL_VERB_RE.test(text)) score += 1;
  if (CONTINUITY_RE.test(text)) score += 2;
  if (GOVERNANCE_RE.test(text)) score += 2;
  if (isIdentityBearing(text)) score += 2;
  if (REJECTED_RE.test(text)) score += 3;
  if (DECISION_RE.test(text)) score += 1;
  if (OPEN_RE.test(text)) score += 2;
  if (text.length >= 32 && text.length <= MAX_PORTABLE_ITEM_LENGTH) score += 1;
  if (text.length > MAX_PORTABLE_ITEM_LENGTH) score -= 1;
  if (text.length > 420) score -= 4;

  if (preferredClass) score += 3;
  if (target === "rejected_directions" && !REJECTED_RE.test(text)) score -= 5;
  if (target === "accepted_decisions" && !preferredClass && !/\b(decision|decided|accepted|approved|chosen|we will)\b/i.test(text)) {
    score -= 3;
  }
  if (target === "continuity_anchors" && !isIdentityBearing(text)) score -= 3;
  if (target === "unresolved_issues" && !OPEN_RE.test(text)) score -= 4;
  if (target === "stable_constraints" && !isOperationallyRelevant(text) && !REJECTED_RE.test(text)) score -= 2;

  if (isConversationDebris(text) || isUiArtifact(text)) score -= 10;
  if (isToolChatter(text) && !isOperationallyRelevant(text)) score -= 6;
  if (isScreenshotDebris(text) && !isScreenshotMissionCritical(context)) score -= 6;
  if (isQuotedBlockNoise(text)) score -= 5;
  if (isMetaDirectiveHeading(text)) score -= 5;
  return score;
}

function classifyStateFragment(input: CandidateInput, text: string, target: AdmissionTarget, context: AdmissionContext): ClassifiedFragment {
  const clean = cleanFragmentText(text);
  if (!clean) {
    return { originalText: text, text: clean, fragmentClass: "discard", score: -10, source: input.source };
  }

  if (isConversationDebris(clean) || isUiArtifact(clean) || isMetaDirectiveHeading(clean)) {
    recordDiscard(context, clean, true);
    return { originalText: text, text: clean, fragmentClass: "discard", score: -10, source: input.source };
  }

  if ((isToolChatter(clean) || isScreenshotDebris(clean)) && !isScreenshotMissionCritical(context)) {
    recordDiagnosticOnly(context, clean);
    return { originalText: text, text: clean, fragmentClass: "diagnostic_only", score: -2, source: input.source };
  }

  if (isQuotedBlockNoise(clean)) {
    recordDiagnosticOnly(context, clean);
    return { originalText: text, text: clean, fragmentClass: "diagnostic_only", score: -1, source: input.source };
  }

  const score = scoreFragment(clean, target, context, input.preferredClass);
  let fragmentClass: FragmentClass = "discard";

  if (input.preferredClass && score >= 2) {
    fragmentClass = input.preferredClass;
  } else if (OPEN_RE.test(clean)) {
    fragmentClass = "unresolved_tension";
  } else if (REJECTED_RE.test(clean)) {
    fragmentClass = "rejected_direction";
  } else if (/\b(decision|decided|accepted|approved|chosen|we will)\b/i.test(clean)) {
    fragmentClass = "accepted_decision";
  } else if (isIdentityBearing(clean) && target === "continuity_anchors") {
    fragmentClass = "continuity_anchor";
  } else if (isOperationallyRelevant(clean)) {
    fragmentClass = "operational_constraint";
  } else if (score >= 2) {
    fragmentClass = "diagnostic_only";
  }

  if (fragmentClass === "discard") {
    recordDiscard(context, clean, true);
  } else if (fragmentClass === "diagnostic_only") {
    recordDiagnosticOnly(context, clean);
  }

  return { originalText: text, text: clean, fragmentClass, score, source: input.source };
}

function allowedClassesFor(target: AdmissionTarget): FragmentClass[] {
  switch (target) {
    case "stable_constraints":
      return ["operational_constraint", "rejected_direction"];
    case "accepted_decisions":
      return ["accepted_decision"];
    case "unresolved_issues":
      return ["unresolved_tension"];
    case "rejected_directions":
      return ["rejected_direction"];
    case "continuity_anchors":
      return ["continuity_anchor", "operational_constraint"];
    case "workflow_evolution":
      return ["operational_constraint", "accepted_decision", "unresolved_tension"];
    case "provisional_state":
      return ["operational_constraint", "unresolved_tension"];
  }
}

function distillLongFragment(text: string, target: AdmissionTarget, context: AdmissionContext): string {
  if (isScreenshotDebris(text) && isScreenshotMissionCritical(context)) {
    return "Use stitched full-page screenshots for before/after workflow continuity comparison.";
  }

  if (text.length <= MAX_PORTABLE_ITEM_LENGTH) return truncatePortable(text);

  const fragments = splitCandidateFragments(text)
    .flatMap((item) => item.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map(cleanFragmentText)
    .filter((item) => item && item.length <= MAX_PORTABLE_ITEM_LENGTH * 1.5);
  const best = fragments
    .map((item) => ({ item, score: scoreFragment(item, target, context) }))
    .filter(({ score }) => score >= 2)
    .sort((left, right) => right.score - left.score || left.item.length - right.item.length)[0]?.item;

  return truncatePortable(best ?? text);
}

function isTrueRejectedDirection(text: string): boolean {
  return (
    REJECTED_RE.test(text) &&
    (isOperationallyRelevant(text) || GOVERNANCE_RE.test(text) || CONTINUITY_RE.test(text)) &&
    !isToolChatter(text) &&
    !isConversationDebris(text) &&
    !isUiArtifact(text)
  );
}

function canonicalizeForTarget(text: string, target: AdmissionTarget, context: AdmissionContext): string {
  const distilled = distillLongFragment(text, target, context)
    .replace(/^(?:decision|constraint|requirement|open question|risk|note|objective|stable core|rejected direction):\s*/i, "")
    .trim();
  if (target === "rejected_directions" && text.length !== distilled.length) {
    context.normalizedRejected += 1;
  }
  return distilled;
}

function preferCandidate(current: string, next: string): string {
  const currentScore = (current.length <= MAX_PORTABLE_ITEM_LENGTH ? 2 : 0) + (OPERATIONAL_VERB_RE.test(current) ? 1 : 0);
  const nextScore = (next.length <= MAX_PORTABLE_ITEM_LENGTH ? 2 : 0) + (OPERATIONAL_VERB_RE.test(next) ? 1 : 0);
  if (nextScore > currentScore) return next;
  if (nextScore === currentScore && next.length < current.length) return next;
  return current;
}

function admitCandidates(inputs: CandidateInput[], target: AdmissionTarget, context: AdmissionContext, limit: number): string[] {
  const allowed = allowedClassesFor(target);
  const output: string[] = [];

  for (const input of inputs) {
    for (const fragment of splitCandidateFragments(input.text)) {
      const classified = classifyStateFragment(input, fragment, target, context);
      if (!allowed.includes(classified.fragmentClass)) continue;
      if (target === "rejected_directions" && !isTrueRejectedDirection(classified.text)) {
        recordDiagnosticOnly(context, classified.text);
        continue;
      }
      if (target === "continuity_anchors" && !isIdentityBearing(classified.text) && classified.score < 4) {
        recordDiagnosticOnly(context, classified.text);
        continue;
      }

      const canonical = canonicalizeForTarget(classified.text, target, context);
      if (!canonical || canonical.length < 4) continue;

      const duplicateIndex = output.findIndex((item) => isMeaningfullyDuplicate(item, canonical, 0.74));
      if (duplicateIndex >= 0) {
        output[duplicateIndex] = preferCandidate(output[duplicateIndex], canonical);
        continue;
      }
      output.push(canonical);
    }
  }

  return uniqueMeaningfulStrings(output).slice(0, limit);
}

function objectiveCandidatesFromText(text: string): string[] {
  const candidates: string[] = [];
  const patterns = [
    /(?:active objective|objective|purpose|mission|goal|next engineering objective|current objective)\s*(?:is|:)\s*([^\n]{16,220})/gi,
    /(?:the goal is|the next step is|next patch)\s*:?\s*([^\n]{16,220})/gi,
    /(?:implement|evaluate|refine|tighten|fix|build)\s+([^\n.]{16,220})[.]/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      candidates.push(cleanFragmentText(match[1] ?? match[0]));
    }
  }

  candidates.push(
    ...splitCandidateFragments(text).filter((line) =>
      /\b(implement|evaluate|refine|tighten|fix|build|preserve)\b/i.test(line) && OPERATIONAL_RE.test(line)
    )
  );
  return uniqueMeaningfulStrings(candidates).slice(0, 12);
}

function derivedObjectiveFromMission(missionText: string): string | undefined {
  if (/\b(state hygiene|semantic admission|admission filtering|admission layer)\b/i.test(missionText)) {
    return "Implement semantic admission filtering for Workflow, Capsule, and Diagnostic exports.";
  }
  if (/\bsave\/export|save and export|saved state|exported state\b/i.test(missionText) && /\bcontinuity\b/i.test(missionText)) {
    return "Evaluate Prompt Accelerator continuity behavior and refine save/export functionality.";
  }
  if (/\bcapsule\b/i.test(missionText) && /\bportable|compact|carry[-\s]?forward\b/i.test(missionText)) {
    return "Create a compact portable continuity capsule for the active workflow.";
  }
  return undefined;
}

function isWeakObjective(objective: string): boolean {
  const clean = cleanFragmentText(objective);
  const words = clean.split(/\s+/).filter(Boolean);
  return (
    !clean ||
    words.length <= 3 ||
    /^(hybrid workspace|workspace|continuity|prompt review|review|session|untitled|continue|active session)$/i.test(clean) ||
    (clean.length < 34 && !OPERATIONAL_VERB_RE.test(clean) && !/[.!?]/.test(clean))
  );
}

function scoreObjectiveCandidate(objective: string): number {
  let score = 0;
  if (objective.length >= 28 && objective.length <= 180) score += 3;
  if (OPERATIONAL_RE.test(objective)) score += 3;
  if (OPERATIONAL_VERB_RE.test(objective)) score += 2;
  if (CONTINUITY_RE.test(objective)) score += 2;
  if (isIdentityBearing(objective)) score += 1;
  if (isWeakObjective(objective)) score -= 4;
  if (isConversationDebris(objective) || isUiArtifact(objective) || isMetaDirectiveHeading(objective)) score -= 8;
  return score;
}

function normalizeObjective(result: TransformResult, transformedText: string, context: AdmissionContext): string {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const current = cleanFragmentText(review.activeObjective);
  const generated = derivedObjectiveFromMission(context.missionText);
  const candidates = uniqueMeaningfulStrings([
    current,
    parsed?.active_objective,
    generated,
    ...objectiveCandidatesFromText(result.originalText),
    ...objectiveCandidatesFromText(result.normalizedText),
    ...objectiveCandidatesFromText(transformedText)
  ].filter(Boolean) as string[]);
  const ranked = candidates
    .map((item) => ({ item: truncatePortable(item, 180), score: scoreObjectiveCandidate(item) }))
    .filter(({ item }) => item && !isConversationDebris(item) && !isUiArtifact(item))
    .sort((left, right) => right.score - left.score || left.item.length - right.item.length);
  const best = ranked[0]?.item ?? current;
  const currentScore = scoreObjectiveCandidate(current);
  const bestScore = ranked[0]?.score ?? currentScore;
  const normalized = isWeakObjective(current) || bestScore > currentScore + 2 ? best : current;
  const fallback = "Continue the reviewed continuity workflow.";
  const finalObjective = truncatePortable(normalized || fallback, 180);

  if (current && finalObjective && !isMeaningfullyDuplicate(current, finalObjective, 0.82)) {
    context.objectiveNormalized = { from: current, to: finalObjective };
  }

  return finalObjective;
}

function buildAdmissionWarnings(context: AdmissionContext): string[] {
  return uniqueNonEmpty([
    context.debrisRemoved > 0 ? "Excess conversational debris removed from stable state." : "",
    context.normalizedRejected > 0 ? "Rejected directions normalized from long-form raw text." : "",
    context.objectiveNormalized ? "Active objective normalized from weak or generic label." : "",
    context.diagnosticOnly.length ? "Provisional state contained non-portable fragments." : "",
    context.compactedCapsuleText ? "Capsule compactness improved by admission filtering." : ""
  ]);
}

function portableAdmissionSummary(diagnostics: AdmittedContinuityState["diagnostics"]): Record<string, unknown> {
  return {
    warnings: diagnostics.warnings,
    discarded_fragment_count: diagnostics.discarded_fragment_count,
    debris_removed_count: diagnostics.debris_removed_count,
    normalized_rejected_direction_count: diagnostics.normalized_rejected_direction_count,
    objective_normalized: diagnostics.objective_normalized,
    capsule_text_compacted: diagnostics.capsule_text_compacted
  };
}

function makeAdmissionContext(result: TransformResult, objectiveHint: string): AdmissionContext {
  return {
    objectiveHint,
    missionText: [result.originalText, result.normalizedText, result.transformedText, result.continuityReview.cleanSummary]
      .filter(Boolean)
      .join("\n"),
    diagnosticOnly: [],
    diagnosticKeys: new Set<string>(),
    discardedKeys: new Set<string>(),
    debrisRemoved: 0,
    normalizedRejected: 0
  };
}

function compactTextSection(title: string, items: string[], limit = MAX_CAPSULE_TEXT_ITEMS): string[] {
  return bulletSection(title, items.slice(0, limit));
}

function portableContinuityText(input: {
  activeObjective: string;
  stableConstraints: string[];
  acceptedDecisions: string[];
  unresolvedIssues: string[];
  rejectedDirections: string[];
  continuityAnchors: string[];
  provisionalState?: string[];
  includeProvisional?: boolean;
}): string {
  const sections = [
    ["Continuity Review"],
    ["Active Objective", input.activeObjective],
    bulletSection("Stable Constraints", input.stableConstraints.slice(0, MAX_PORTABLE_CONTEXT_ITEMS), "No stable constraints admitted."),
    bulletSection("Accepted Decisions", input.acceptedDecisions.slice(0, MAX_PORTABLE_CONTEXT_ITEMS)),
    bulletSection("Open / Unresolved", input.unresolvedIssues.slice(0, MAX_PORTABLE_CONTEXT_ITEMS)),
    bulletSection("Rejected Directions", input.rejectedDirections.slice(0, MAX_PORTABLE_CONTEXT_ITEMS)),
    bulletSection("Continuity Anchors", input.continuityAnchors.slice(0, MAX_PORTABLE_CONTEXT_ITEMS)),
    input.includeProvisional ? bulletSection("New / Provisional", input.provisionalState?.slice(0, 4) ?? []) : []
  ];
  return sections
    .filter((section) => section.length)
    .map((section) => section.join("\n"))
    .join("\n\n");
}

function buildAdmittedState(result: TransformResult, transformedText: string): AdmittedContinuityState {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const preliminaryObjective = cleanFragmentText(review.activeObjective);
  const context = makeAdmissionContext(result, preliminaryObjective);
  const activeObjective = normalizeObjective(result, transformedText, context);
  context.objectiveHint = activeObjective;

  const stableConstraints = admitCandidates(
    [
      ...candidatesFrom(result.extractedConstraints.map((constraint) => constraint.text), "extracted_constraints"),
      ...candidatesFrom(parsed?.stable_constraints ?? [], "parsed_capsule.stable_constraints", "operational_constraint"),
      ...candidatesFrom(review.stableCore, "continuity_review.stable_core")
    ],
    "stable_constraints",
    context,
    12
  );
  const acceptedDecisions = admitCandidates(
    [
      ...candidatesFrom(parsed?.accepted_decisions ?? [], "parsed_capsule.accepted_decisions", "accepted_decision"),
      ...candidatesFrom(review.whatChanged, "continuity_review.what_changed")
    ],
    "accepted_decisions",
    context,
    8
  );
  const unresolvedIssues = admitCandidates(
    [
      ...candidatesFrom(parsed?.open_questions ?? [], "parsed_capsule.open_questions", "unresolved_tension"),
      ...candidatesFrom(parsed?.unresolved_risks ?? [], "parsed_capsule.unresolved_risks", "unresolved_tension"),
      ...candidatesFrom(review.openUnresolved, "continuity_review.open_unresolved", "unresolved_tension")
    ],
    "unresolved_issues",
    context,
    10
  );
  const provisionalState = admitCandidates(
    candidatesFrom(review.newProvisional, "continuity_review.new_provisional"),
    "provisional_state",
    context,
    8
  );
  const rejectedDirections = admitCandidates(
    [
      ...candidatesFrom(stableConstraints, "admitted.stable_constraints"),
      ...candidatesFrom(parsed?.stable_constraints ?? [], "parsed_capsule.stable_constraints"),
      ...candidatesFrom(review.stableCore, "continuity_review.stable_core"),
      ...candidatesFrom(result.extractedConstraints.map((constraint) => constraint.text), "extracted_constraints")
    ],
    "rejected_directions",
    context,
    8
  );
  const continuityAnchors = admitCandidates(
    [
      candidate(activeObjective, "admitted.active_objective", "continuity_anchor"),
      candidate(parsed?.metadata.title, "parsed_capsule.title", "continuity_anchor"),
      candidate(review.diagnostics.rawCapsule?.title, "raw_capsule.title", "continuity_anchor"),
      ...candidatesFrom(stableConstraints, "admitted.stable_constraints"),
      ...candidatesFrom(acceptedDecisions, "admitted.accepted_decisions")
    ],
    "continuity_anchors",
    context,
    10
  );
  const workflowEvolution = admitCandidates(
    candidatesFrom(review.whatChanged, "continuity_review.what_changed"),
    "workflow_evolution",
    context,
    8
  );
  const carryForwardContext = portableContinuityText({
    activeObjective,
    stableConstraints,
    acceptedDecisions,
    unresolvedIssues,
    rejectedDirections,
    continuityAnchors,
    provisionalState,
    includeProvisional: true
  });
  const capsuleText = [
    "Saved from Continuity Review.",
    `Objective: ${activeObjective}`,
    ...compactTextSection("Stable Constraints", stableConstraints),
    ...compactTextSection("Accepted Decisions", acceptedDecisions),
    ...compactTextSection("Open / Unresolved", unresolvedIssues),
    ...compactTextSection("Rejected Directions", rejectedDirections, 2),
    ...compactTextSection("Continuity Anchors", continuityAnchors, 2),
    ...compactTextSection("Recommended Next Actions", admitCandidates(candidatesFrom(review.recommendedNextActions, "continuity_review.recommended_next_actions"), "workflow_evolution", context, 2))
  ]
    .filter(Boolean)
    .join("\n");
  const rawNotesLength = [review.cleanSummary, ...review.newProvisional, ...review.recommendedNextActions, transformedText].join("\n").length;
  if (capsuleText.length < rawNotesLength) {
    context.compactedCapsuleText = { before: rawNotesLength, after: capsuleText.length };
  }

  return {
    activeObjective,
    stableConstraints,
    acceptedDecisions,
    unresolvedIssues,
    rejectedDirections,
    continuityAnchors,
    provisionalState,
    workflowEvolution,
    carryForwardContext,
    capsuleText,
    diagnostics: {
      warnings: buildAdmissionWarnings(context),
      diagnostic_only_fragments: context.diagnosticOnly.slice(0, 20),
      discarded_fragment_count: context.discardedKeys.size,
      debris_removed_count: context.debrisRemoved,
      normalized_rejected_direction_count: context.normalizedRejected,
      objective_normalized: context.objectiveNormalized,
      capsule_text_compacted: context.compactedCapsuleText
    }
  };
}

function compactGovernanceSummary(sessionState: SessionGovernanceState | null): Record<string, unknown> {
  if (!sessionState) {
    return {};
  }
  return {
    session_id: sessionState.id,
    title: sessionState.title,
    stable_core: sessionState.stableCore,
    openness: sessionState.opennessLane,
    monitors: sessionState.monitors,
    diagnostics: sessionState.diagnostics
  };
}

function scoreSummary(result: TransformResult): Record<string, number | undefined> {
  return {
    compactness_score: result.scores.compactnessScore,
    constraint_preservation_score: result.scores.constraintPreservationScore,
    risk_score: result.scores.riskScore,
    redundancy_before: result.scores.redundancyScoreBefore,
    redundancy_after: result.scores.redundancyScoreAfter,
    mode_alignment_score: result.scores.modeAlignmentScore,
    adaptation_alignment_score: result.scores.adaptationAlignmentScore
  };
}

function diagnosticMetadata(result: TransformResult, transformedText: string, extensionVersion?: string): Record<string, unknown> {
  return {
    source_surface: sourcePlatform(result),
    target_model: result.targetModelApplied ?? result.continuityReview.diagnostics.targetModel,
    requested_mode: result.continuityReview.diagnostics.requestedMode,
    mode_applied: result.modeApplied,
    pipeline_steps: result.continuityReview.diagnostics.pipelineSteps,
    raw_input_length: result.originalText.length,
    normalized_length: result.normalizedText.length,
    transformed_length: transformedText.length,
    scores: scoreSummary(result),
    extension_version: extensionVersion
  };
}

function sourcePlatform(result: TransformResult): string {
  const diagnostics = result.continuityReview.diagnostics;
  return (
    diagnostics.sourceSurface ??
    diagnostics.rawCapsule?.sourceSurface ??
    diagnostics.parsedCapsule?.metadata.sourceSurface ??
    result.targetModelApplied ??
    "unknown"
  );
}

export function formatContinuityExport(result: TransformResult, transformedText: string): string {
  const review = result.continuityReview;
  const admitted = buildAdmittedState(result, transformedText);
  const sections = [
    ["Continuity Review"],
    ["Active Objective", admitted.activeObjective],
    bulletSection(
      "Stable Core",
      uniqueNonEmpty([...admitted.stableConstraints, ...admitted.acceptedDecisions]),
      "No stable constraints or accepted decisions detected."
    ),
    bulletSection("New / Provisional", admitted.provisionalState, "No new provisional changes detected."),
    bulletSection("Open / Unresolved", admitted.unresolvedIssues),
    bulletSection("Recommended Next Actions", review.recommendedNextActions),
    transformedText.trim() ? ["Transformed Continuity Draft", transformedText.trim()] : []
  ];

  return sections
    .filter((section) => section.length)
    .map((section) => section.join("\n"))
    .join("\n\n");
}

export function buildWorkflowDraft(result: TransformResult, transformedText: string): WorkflowDraft {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const admitted = buildAdmittedState(result, transformedText);
  const stableConstraints = admitted.stableConstraints;
  const acceptedDecisions = admitted.acceptedDecisions;
  const openIssues = admitted.unresolvedIssues;
  const title = titleFromObjective(admitted.activeObjective, "Continuity workflow");

  return {
    version: 1,
    title,
    source_platform: sourcePlatform(result),
    detected_model: result.targetModelApplied ?? review.diagnostics.targetModel,
    active_objective: admitted.activeObjective,
    objective: admitted.activeObjective || cleanLine(transformedText) || "Continue the reviewed prompt workflow.",
    mode: result.modeApplied ?? parsed?.preferred_mode ?? "precision",
    constraints: stableConstraints,
    stable_constraints: stableConstraints,
    accepted_decisions: acceptedDecisions,
    unresolved_issues: openIssues,
    provisional_state: admitted.provisionalState,
    continuity_review: {
      clean_summary: review.cleanSummary,
      active_objective: admitted.activeObjective,
      stable_core: stableConstraints,
      accepted_decisions: acceptedDecisions,
      provisional_state: admitted.provisionalState,
      open_unresolved: openIssues,
      what_changed: admitted.workflowEvolution,
      recommended_next_actions: review.recommendedNextActions
    },
    continuity_state_history: [
      {
        source: "continuity_review",
        active_objective: admitted.activeObjective,
        stable_core_count: stableConstraints.length,
        unresolved_count: openIssues.length,
        admission_warnings: admitted.diagnostics.warnings
      }
    ],
    workflow_evolution: admitted.workflowEvolution.map((change) => ({ change })),
    diagnostic_data: {
      ...diagnosticMetadata(result, transformedText),
      admission_filter: portableAdmissionSummary(admitted.diagnostics)
    },
    risk_scores: { risk_score: result.scores.riskScore },
    compression_metrics: {
      compactness_score: result.scores.compactnessScore,
      redundancy_before: result.scores.redundancyScoreBefore,
      redundancy_after: result.scores.redundancyScoreAfter
    },
    constraint_integrity_metrics: {
      constraint_preservation_score: result.scores.constraintPreservationScore,
      extracted_constraints: result.extractedConstraints.length,
      stable_constraints: stableConstraints.length
    },
    session_metadata: {
      source: "review_window",
      transformed_length: transformedText.length
    },
    platform_metadata: {
      source_platform: sourcePlatform(result),
      detected_model: result.targetModelApplied ?? review.diagnostics.targetModel
    },
    outputPreferences: uniqueNonEmpty([
      ...result.explanation,
      ...acceptedDecisions.map((decision) => `Accepted decision: ${decision}`),
      ...review.recommendedNextActions.map((action) => `Next action: ${action}`)
    ]).slice(0, 16),
    carryForwardContext: admitted.carryForwardContext,
    targetModel: result.targetModelApplied,
    tags: uniqueNonEmpty(["continuity-review", result.targetModelApplied])
  };
}

export function buildCapsuleDraft(result: TransformResult, transformedText: string): CapsuleDraft {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const admitted = buildAdmittedState(result, transformedText);
  const title = `${titleFromObjective(admitted.activeObjective, "Continuity")} Capsule`;
  const constraints = admitted.stableConstraints;
  const decisions = admitted.acceptedDecisions;
  const openQuestions = admitted.unresolvedIssues;
  const notes = admitted.capsuleText;

  return {
    version: 1,
    title,
    workflow_identity: titleFromObjective(admitted.activeObjective, "Continuity workflow"),
    source_platform: sourcePlatform(result),
    detected_model: result.targetModelApplied ?? review.diagnostics.targetModel,
    active_objective: admitted.activeObjective,
    objective: admitted.activeObjective || cleanLine(transformedText) || "Continue the reviewed session.",
    constraints,
    stable_constraints: constraints,
    decisions,
    accepted_decisions: decisions,
    open_questions: openQuestions,
    unresolved_issues: openQuestions,
    governance_state: {},
    rejected_directions: admitted.rejectedDirections,
    continuity_anchors: admitted.continuityAnchors,
    reconstruction_instructions:
      "Use active_objective, stable_constraints, accepted_decisions, unresolved_issues, and continuity_anchors to reconstruct the working context before continuing.",
    model_transfer_notes: {
      target_model: result.targetModelApplied,
      preferred_mode: result.modeApplied ?? parsed?.preferred_mode,
      source_platform: sourcePlatform(result)
    },
    diagnostic_metadata: {
      ...diagnosticMetadata(result, transformedText),
      admission_filter: portableAdmissionSummary(admitted.diagnostics)
    },
    preferred_mode: result.modeApplied ?? parsed?.preferred_mode,
    notes,
    sourceSurface: review.diagnostics.sourceSurface ?? result.targetModelApplied
  };
}

export function buildPortableCapsuleArtifact(
  capsule: CarryForwardCapsule,
  context: ReviewArtifactContext
): Record<string, unknown> {
  const review = context.result.continuityReview;
  const admitted = buildAdmittedState(context.result, context.transformedText);
  return {
    capsule_id: capsule.capsule_id ?? capsule.id,
    version: capsule.version ?? capsule.capsule_version,
    created_at: capsule.created_at,
    updated_at: capsule.updated_at ?? capsule.created_at,
    title: capsule.title,
    workflow_identity: capsule.workflow_identity ?? titleFromObjective(admitted.activeObjective, "Continuity workflow"),
    source_platform: capsule.source_platform ?? sourcePlatform(context.result),
    detected_model: capsule.detected_model ?? context.result.targetModelApplied ?? review.diagnostics.targetModel,
    active_objective: admitted.activeObjective,
    stable_constraints: admitted.stableConstraints,
    accepted_decisions: admitted.acceptedDecisions,
    unresolved_issues: admitted.unresolvedIssues,
    governance_state: capsule.governance_state ?? compactGovernanceSummary(context.sessionState),
    rejected_directions: admitted.rejectedDirections,
    continuity_anchors: admitted.continuityAnchors,
    reconstruction_instructions:
      capsule.reconstruction_instructions ??
      "Reconstruct the active objective, stable constraints, accepted decisions, unresolved issues, and continuity anchors before continuing the workflow.",
    model_transfer_notes: capsule.model_transfer_notes ?? {
      source_platform: sourcePlatform(context.result),
      target_model: context.result.targetModelApplied,
      preferred_mode: capsule.preferred_mode
    },
    diagnostic_metadata: {
      ...(capsule.diagnostic_metadata ?? diagnosticMetadata(context.result, context.transformedText, context.extensionVersion)),
      admission_filter: portableAdmissionSummary(admitted.diagnostics)
    },
    capsule_text: admitted.capsuleText
  };
}

export function buildPortableWorkflowArtifact(workflow: Workflow, context: ReviewArtifactContext): Record<string, unknown> {
  const admitted = buildAdmittedState(context.result, context.transformedText);
  return {
    workflow_id: workflow.workflow_id ?? workflow.id,
    version: workflow.version ?? 1,
    created_at: workflow.createdAt,
    updated_at: workflow.updatedAt,
    title: workflow.title,
    source_platform: workflow.source_platform ?? sourcePlatform(context.result),
    detected_model: workflow.detected_model ?? workflow.targetModel ?? context.result.targetModelApplied,
    active_objective: admitted.activeObjective,
    stable_constraints: admitted.stableConstraints,
    accepted_decisions: admitted.acceptedDecisions,
    unresolved_issues: admitted.unresolvedIssues,
    provisional_state: admitted.provisionalState,
    continuity_review: workflow.continuity_review ?? {
      active_objective: admitted.activeObjective,
      stable_core: admitted.stableConstraints,
      accepted_decisions: admitted.acceptedDecisions,
      open_unresolved: admitted.unresolvedIssues
    },
    continuity_state_history: workflow.continuity_state_history ?? [],
    workflow_evolution: workflow.workflow_evolution ?? admitted.workflowEvolution.map((change) => ({ change })),
    diagnostic_data: {
      ...(workflow.diagnostic_data ?? diagnosticMetadata(context.result, context.transformedText, context.extensionVersion)),
      admission_filter: portableAdmissionSummary(admitted.diagnostics)
    },
    risk_scores: workflow.risk_scores ?? { risk_score: context.result.scores.riskScore },
    compression_metrics: workflow.compression_metrics ?? {
      compactness_score: context.result.scores.compactnessScore,
      redundancy_before: context.result.scores.redundancyScoreBefore,
      redundancy_after: context.result.scores.redundancyScoreAfter
    },
    constraint_integrity_metrics: workflow.constraint_integrity_metrics ?? {
      constraint_preservation_score: context.result.scores.constraintPreservationScore,
      stable_constraints: workflow.constraints.length
    },
    session_metadata: workflow.session_metadata ?? compactGovernanceSummary(context.sessionState),
    platform_metadata: workflow.platform_metadata ?? {
      source_platform: sourcePlatform(context.result),
      current_url_or_domain: context.currentUrl,
      extension_version: context.extensionVersion
    },
    carry_forward_context: admitted.carryForwardContext
  };
}

export function buildDiagnosticState(context: ReviewArtifactContext): Record<string, unknown> {
  const review = context.result.continuityReview;
  const admitted = buildAdmittedState(context.result, context.transformedText);
  return {
    diagnostic_id: `diagnostic-${Date.now()}`,
    version: 1,
    timestamp: new Date().toISOString(),
    clean_summary: review.cleanSummary,
    active_objective: admitted.activeObjective,
    stable_core: uniqueNonEmpty([...admitted.stableConstraints, ...admitted.acceptedDecisions]),
    provisional_state: admitted.provisionalState,
    open_unresolved: admitted.unresolvedIssues,
    rejected_directions: admitted.rejectedDirections,
    continuity_anchors: admitted.continuityAnchors,
    portable_capsule_snapshot: context.capsule ? buildPortableCapsuleArtifact(context.capsule, context) : null,
    portable_workflow_snapshot: context.workflow ? buildPortableWorkflowArtifact(context.workflow, context) : null,
    raw_capsule: context.capsule ?? review.diagnostics.rawCapsule ?? null,
    raw_workflow_state: context.workflow ?? null,
    compression_score: context.result.scores.compactnessScore,
    constraint_score: context.result.scores.constraintPreservationScore,
    risk_score: context.result.scores.riskScore,
    continuity_metrics: context.sessionState?.monitors ?? {
      compactness_score: context.result.scores.compactnessScore,
      constraint_preservation_score: context.result.scores.constraintPreservationScore,
      risk_score: context.result.scores.riskScore
    },
    platform: sourcePlatform(context.result),
    detected_model: context.result.targetModelApplied ?? review.diagnostics.targetModel,
    current_url_or_domain: context.currentUrl,
    extension_version: context.extensionVersion,
    active_constraints: context.result.extractedConstraints,
    admission_filter: admitted.diagnostics,
    warnings: uniqueNonEmpty([...(context.sessionState?.diagnostics.warnings ?? []), ...admitted.diagnostics.warnings]),
    diagnostic_logs: review.diagnostics.pipelineSteps,
    raw_review_state: {
      active_objective: review.activeObjective,
      stable_core: review.stableCore,
      provisional_state: review.newProvisional,
      open_unresolved: review.openUnresolved,
      what_changed: review.whatChanged,
      recommended_next_actions: review.recommendedNextActions
    },
    last_transformation_result: {
      mode_applied: context.result.modeApplied,
      target_model_applied: context.result.targetModelApplied,
      explanation: context.result.explanation,
      diff_blocks: context.result.diff.length,
      transformed_text: context.transformedText
    },
    save_status: context.saveStatus,
    export_status: context.exportStatus,
    error_logs: context.errorLogs ?? []
  };
}

export function formatDiagnosticMarkdown(context: ReviewArtifactContext): string {
  const diagnostic = buildDiagnosticState(context);
  const lines = [
    "# LuxCrypta Diagnostic State",
    "",
    `Timestamp: ${diagnostic.timestamp}`,
    `Version: ${diagnostic.version}`,
    `Platform: ${diagnostic.platform ?? "unknown"}`,
    `Detected model: ${diagnostic.detected_model ?? "unknown"}`,
    `Extension version: ${diagnostic.extension_version}`,
    "",
    "## Clean Summary",
    String(diagnostic.clean_summary ?? ""),
    "",
    "## Active Objective",
    String(diagnostic.active_objective ?? ""),
    "",
    ...bulletSection("## Stable Core", diagnostic.stable_core as string[], "No stable core items."),
    "",
    ...bulletSection("## Provisional State", diagnostic.provisional_state as string[], "No provisional items."),
    "",
    ...bulletSection("## Open / Unresolved", diagnostic.open_unresolved as string[], "No open items."),
    "",
    ...bulletSection("## Rejected Directions", diagnostic.rejected_directions as string[], "No rejected directions admitted."),
    "",
    ...bulletSection("## Warnings", diagnostic.warnings as string[], "No diagnostic warnings."),
    "",
    "## Scores",
    `- Compression: ${diagnostic.compression_score}`,
    `- Constraint: ${diagnostic.constraint_score}`,
    `- Risk: ${diagnostic.risk_score}`,
    "",
    "## Raw JSON",
    "```json",
    JSON.stringify(diagnostic, null, 2),
    "```"
  ];
  return lines.join("\n");
}

export function artifactFilename(kind: "capsule" | "workflow" | "diagnostic", title: string, timestamp = new Date()): string {
  const safeTitle = cleanLine(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `luxcrypta-${kind}-${safeTitle || "artifact"}-${timestamp.toISOString().slice(0, 10)}.json`;
}
