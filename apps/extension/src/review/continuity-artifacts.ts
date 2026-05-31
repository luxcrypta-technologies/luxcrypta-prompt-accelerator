import type { CarryForwardCapsule } from "@/types/capsules";
import { getBuildProvenance } from "@/app/build-info";
import type { SessionGovernanceState } from "@/types/governance";
import type { MutationTarget, TransformResult } from "@/types/prompts";
import type { Workflow } from "@/types/workflows";
import { isMeaningfullyDuplicate, normalizeMeaning, uniqueMeaningfulStrings } from "@/utils/text";

type WorkflowDraft = Omit<Workflow, "id" | "createdAt" | "updatedAt">;
export type CapsuleDraft = Omit<
  CarryForwardCapsule,
  "capsule_version" | "id" | "created_at" | "updated_at"
>;

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
  // Stage 0 capture-verification fields (so staleness/keying is provable).
  conversationId?: string | null;
  conversationKey?: string | null;
  conversationKeyIsEphemeral?: boolean;
  snapshotScope?: {
    turns_captured: number;
    capture_scope: "full" | "partial" | "empty";
    coverage_confidence: "high" | "medium" | "low";
    role_attribution: "dom_markers" | "positional_fallback";
  } | null;
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
  governancePrinciples: string[];
  invariants: string[];
  continuitySafeguards: string[];
  quarantineLog: string[];
  deferredItems: string[];
  conditionalAdmissions: string[];
  mutationTargets: MutationTarget[];
  continuityAnchors: string[];
  provisionalState: string[];
  workflowEvolution: string[];
  recommendedNextActions: string[];
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
    export_source_mode:
      | "session_durable_state"
      | "session_durable_state_with_latest_fill"
      | "latest_turn_admitted"
      | "blocked_last_turn_only";
    session_durable_item_count: number;
    latest_turn_durable_item_count: number;
    durable_items_carried_forward_count: number;
    durable_items_overridden_by_latest_turn_count: number;
    session_items_considered_count: number;
    session_items_admitted_count: number;
    session_items_rejected_as_shell_count: number;
    fallback_to_latest_turn_only: boolean;
    session_level_capsule_passed: boolean;
    quality_gate_blockers: string[];
  };
}

type HandoffDecision = "SAFE_FOR_HANDOFF" | "UNSAFE_FOR_HANDOFF";

export interface FinalArtifactTruth {
  final_artifact_source_mode: AdmittedContinuityState["diagnostics"]["export_source_mode"];
  final_artifact_objective: string;
  final_evaluated_objective: string;
  final_artifact_durable_count: number;
  final_artifact_durable_item_count: number;
  final_artifact_readiness_decision: HandoffDecision;
  final_export_readiness_decision: HandoffDecision;
  final_artifact_blockers: string[];
  final_readiness_blockers: string[];
  final_missing_state_summary: string[];
  session_items_considered_count: number;
  session_items_admitted_count: number;
  session_items_rejected_as_shell_count: number;
  review_export_truth_match: boolean;
}

const OPERATIONAL_RE =
  /\b(continuity|workflow|capsule|diagnostic|save|export|state|runtime|governance|objective|constraint|decision|unresolved|anchor|portable|artifact|review|session|model|extension|toolbar|admission|filter|semantic|carry[-\s]?forward|cognition|prompt accelerator|luxcrypta|stable core|raw json|product|prompt optimization|chat history|review surface|compress|focus)\b/i;
const OPERATIONAL_VERB_RE =
  /\b(preserve|keep|maintain|avoid|exclude|downgrade|quarantine|normalize|distill|dedupe|build|save|export|refine|evaluate|reconstruct|continue|separate|classify|filter|attach|protect|tighten|reduce|implement|route|promote|carry forward)\b/i;
const GOVERNANCE_RE =
  /\b(governance|trusted|untrusted|stable core|accepted decision|rejected direction|unresolved|open question|risk|continuity invariant|cognition)\b/i;
const CONTINUITY_RE =
  /\b(continuity|carry[-\s]?forward|reconstruct|workflow identity|session|portable|capsule|anchor)\b/i;
const REJECTED_RE =
  /\b(do not|don't|never|avoid|forbidden|must not|should not|no\s+\w+|exclude|without)\b/i;
const DECISION_RE =
  /\b(decision|decided|accepted|approved|we will|chosen|locked|keep\b|use\b|preserve\b)\b/i;
const OPEN_RE =
  /\?|(?:\b(open question|unclear|unknown|risk|unresolved|needs confirmation|tension|blocked|uncertain|investigate)\b)/i;
const IDENTITY_RE =
  /\b(luxcrypta|prompt accelerator|continuity runtime|browser extension|workflow identity|operational cognition|save\/export|workflow|capsule|diagnostic)\b/i;
const PROMPT_SHELL_EXPORT_RE =
  /\b(at the end provide|required engineering note format|what changed|why it was failing|bad before|corrected after|files changed|validation required|live status|success criteria|required tests|out of scope|return exactly|copy this final prompt only|do not turn this into a paragraph)\b/i;
const FORMAT_ONLY_STATE_RE =
  /^(?:keep (?:this|it|the response|responses?|sections?) short|keep sections separate(?:\s+\d+\.?)?|do not turn this into a paragraph\.?|return exactly (?:these|the)\b.*\b(?:labeled sections?|nothing else)\.?)$/i;
const PROMPT_SHELL_LABEL_RE =
  /^(?:user|assistant|system|developer|model|human|ai|active objective|objective|stable constraints|accepted decisions|what is unresolved|rejected directions|governance principles|invariants|continuity safeguards|output format|response format):?$/i;
const SECTION_LABEL_TOKEN_RE =
  /\b(active objective|objective|stable constraints|accepted decisions|what is unresolved|rejected directions|open\s*\/\s*unresolved(?: issues)?|open questions?|governance principles|invariants|continuity safeguards|output format|response format)\b/gi;
const SECTION_LABEL_TRAILING_SENTENCE_RE =
  /[.!?;:]\s*(?:active objective|objective|stable constraints|accepted decisions|what is unresolved|rejected directions|open\s*\/\s*unresolved(?: issues)?|open questions?|governance principles|invariants|continuity safeguards|output format|response format)\s*$/i;
const QUESTION_FRAGMENT_OBJECTIVE_RE =
  /^(?:does|do|is|are|can|could|should|would|will|what|why|how)\b/i;
const GENERATED_CARRY_FORWARD_SCAFFOLD_RE =
  /^(?:keep the stable core intact unless the user explicitly changes it|reduce repetition and keep the response anchored to the active objective|keep unresolved questions visible instead of silently resolving or dropping them|use active_objective, stable_constraints|reconstruct the active objective|saved from continuity review|saved from accumulated session durable state)\b/i;

function cleanLine(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function scrubProviderChromeTokens(text: string): string {
  if (!/\b(show more|show less|try pro|upsell|host chrome|page chrome|provider chrome)\b/i.test(text)) {
    return text;
  }
  return text
    .replace(/\bshow more\b/gi, "provider chrome")
    .replace(/\bshow less\b/gi, "provider chrome")
    .replace(/\bcopy(?: link)?\b/gi, "provider chrome")
    .replace(/\badvanced\b/gi, "provider chrome")
    .replace(/\btry pro\b/gi, "provider upsell")
    .replace(/\bupgrade\b/gi, "provider upsell")
    .replace(/\b(?:provider chrome)(?:\s*,\s*provider chrome)+/gi, "provider chrome")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFragmentText(value: string | undefined): string {
  return scrubProviderChromeTokens(cleanLine(value))
    .replace(/^```[a-z0-9_-]*\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*(?:#{1,6}\s*)/, "")
    .replace(/^\s*(?:[-*•>]+\s*)+/, "")
    .replace(/^\s*(?:[IVXLCDM]+\.|\d+[.)]|[A-Z]\.)\s+/i, "")
    .replace(
      /^\s*(?:allowed examples?|bad examples?|new rule|required acceptance criteria|acceptance criteria|observed issues include|main fixes|purpose|target behavior|examples?|instead of preserving|governance principles?|invariants?|rejected directions?|continuity safeguards?|quarantine log|deferred items?|open\/unresolved|new\/provisional|stable core):\s*/i,
      ""
    )
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function candidate(
  text: string | undefined,
  source: string,
  preferredClass?: FragmentClass
): CandidateInput {
  return { text, source, preferredClass };
}

function candidatesFrom(
  items: Array<string | undefined>,
  source: string,
  preferredClass?: FragmentClass
): CandidateInput[] {
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
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf(";"),
    clipped.lastIndexOf(",")
  );
  const safe = sentenceEnd > 80 ? clipped.slice(0, sentenceEnd) : clipped;
  return `${safe.trim()}...`;
}

export function titleFromObjective(objective: string | undefined, fallback: string): string {
  const clean = cleanLine(objective)
    .replace(/^active objective:\s*/i, "")
    .replace(/^objective:\s*/i, "");
  return truncate(clean && clean !== "invalid_objective" ? clean : fallback, MAX_TITLE_LENGTH);
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
  const compact = lower.replace(/[^a-z0-9]+/g, "");
  return (
    /^(showmore|showless|showmoreshowless)$/.test(compact) ||
    /^(apply|copy|save|cancel|close|review|workflow|capsule|downloadjson|saveworkflow|savecapsule|copycapsule|copyallreview|copyreviewrawjson|copyengineeringsummary|copyportablecapsule|copyworkflowexport|copyrawdiagnosticdata|exportdiagnosticstate|advanced|retryopen)$/.test(
      compact
    ) ||
    /^(activeobjective|stablecore|newprovisional|openunresolved|recommendednextactions|transformedcontinuitydraft|cleansummary|advanceddiagnostics|rawcapsulediagnosticdata|poweredbyluxcrypta|readytoreview)$/.test(
      compact
    ) ||
    /^(copying|copied|saving workflow|saving capsule|workflow saved|capsule saved|download started|ready to review)\.?$/.test(
      lower
    )
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
    /^please analy[sz]e everything[.! ]*$/.test(lower) ||
    /^(here are|these are|i uploaded|i'?m attaching|attached|uploading)\b.*\b(images?|screenshots?|files?)\b/.test(
      lower
    ) ||
    /^(below is|here is)\b.*\b(copy[-\s]?paste|patch directive|directive|task block|prompt block|instructions?)\b/.test(
      lower
    ) ||
    /\b(giant copied block|upload chatter|screenshot setup)\b/.test(lower) ||
    /^razak[,]?$/.test(lower) ||
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
  if (/\b(first[-\s]?click|without refresh|open path|advanced opens?)\b/i.test(text)) {
    return false;
  }
  return /\b(upload|uploading|click(?:ed)?|browser screenshot|save button|copy button|review window|screenshot workflow)\b/i.test(
    text
  );
}

function isScreenshotDebris(text: string): boolean {
  return /\b(product hunt|browser screenshot|store screenshot|screenshot instructions|full[-\s]?page screenshots?|stitched screenshots?|before\/after screenshot|marketing screenshot)\b/i.test(
    text
  );
}

function isScreenshotMissionCritical(context: AdmissionContext): boolean {
  return /\b(screenshot|store listing|product hunt|promo image|marketing asset)\b/i.test(
    context.objectiveHint
  );
}

function isQuotedBlockNoise(text: string): boolean {
  return (
    text.length > 360 &&
    /\b(copy[-\s]?paste|directive|instructions?|prompt block|quoted|below is|raw review|transcript)\b/i.test(
      text
    )
  );
}

function isOperationallyRelevant(text: string): boolean {
  return (
    OPERATIONAL_RE.test(text) || (OPERATIONAL_VERB_RE.test(text) && text.split(/\s+/).length >= 4)
  );
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

function scoreFragment(
  text: string,
  target: AdmissionTarget,
  context: AdmissionContext,
  preferredClass?: FragmentClass
): number {
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
  if (
    target === "accepted_decisions" &&
    !preferredClass &&
    !/\b(decision|decided|accepted|approved|chosen|we will)\b/i.test(text)
  ) {
    score -= 3;
  }
  if (target === "continuity_anchors" && !isIdentityBearing(text)) score -= 3;
  if (target === "unresolved_issues" && !OPEN_RE.test(text)) score -= 4;
  if (target === "stable_constraints" && !isOperationallyRelevant(text) && !REJECTED_RE.test(text))
    score -= 2;

  if (isConversationDebris(text) || isUiArtifact(text)) score -= 10;
  if (isToolChatter(text) && !isOperationallyRelevant(text)) score -= 6;
  if (isScreenshotDebris(text) && !isScreenshotMissionCritical(context)) score -= 6;
  if (isQuotedBlockNoise(text)) score -= 5;
  if (isMetaDirectiveHeading(text)) score -= 5;
  return score;
}

function classifyStateFragment(
  input: CandidateInput,
  text: string,
  target: AdmissionTarget,
  context: AdmissionContext
): ClassifiedFragment {
  const clean = cleanFragmentText(text);
  if (!clean) {
    return {
      originalText: text,
      text: clean,
      fragmentClass: "discard",
      score: -10,
      source: input.source
    };
  }

  if (
    isConversationDebris(clean) ||
    isUiArtifact(clean) ||
    isMetaDirectiveHeading(clean) ||
    isPortableStateDebris(clean, context)
  ) {
    recordDiscard(context, clean, true);
    return {
      originalText: text,
      text: clean,
      fragmentClass: "discard",
      score: -10,
      source: input.source
    };
  }

  if (
    (isToolChatter(clean) || isScreenshotDebris(clean)) &&
    !isScreenshotMissionCritical(context)
  ) {
    recordDiagnosticOnly(context, clean);
    return {
      originalText: text,
      text: clean,
      fragmentClass: "diagnostic_only",
      score: -2,
      source: input.source
    };
  }

  if (isQuotedBlockNoise(clean)) {
    recordDiagnosticOnly(context, clean);
    return {
      originalText: text,
      text: clean,
      fragmentClass: "diagnostic_only",
      score: -1,
      source: input.source
    };
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

function distillLongFragment(
  text: string,
  target: AdmissionTarget,
  context: AdmissionContext
): string {
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
    .sort(
      (left, right) => right.score - left.score || left.item.length - right.item.length
    )[0]?.item;

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

function isLabeledNonStableState(text: string): boolean {
  return /^\s*(governance principles?|governance principle|invariants?|invariant|rejected directions?|rejected direction|open questions?|open\/unresolved|quarantine|retrieved evidence|retrieval context|deferred items?|continuity safeguards?)\s*:/i.test(
    cleanLine(text)
  );
}

function hasBlendedSectionShell(text: string): boolean {
  const clean = cleanLine(text);
  if (PROMPT_SHELL_LABEL_RE.test(clean)) return true;
  if (SECTION_LABEL_TRAILING_SENTENCE_RE.test(clean)) return true;

  SECTION_LABEL_TOKEN_RE.lastIndex = 0;
  for (const match of clean.matchAll(SECTION_LABEL_TOKEN_RE)) {
    const index = match.index ?? -1;
    if (index <= 0) continue;
    const before = clean.slice(0, index).trim();
    const after = clean.slice(index + match[0].length).trim();
    const charBefore = clean[index - 1] ?? "";
    if (!before) continue;
    if (!/\s/.test(charBefore)) return true;
    if (!after && isFormattingOnlyInstruction(before)) return true;
    if (/^[:\-–—]/.test(after)) return true;
    if (!/[:.;!?]$/.test(before) && /^[:\-–—]?\s*(?:[-*•]\s*)?[A-Z0-9]/.test(after)) {
      return true;
    }
  }

  return false;
}

function isFormattingOnlyInstruction(text: string): boolean {
  return FORMAT_ONLY_STATE_RE.test(cleanLine(text).replace(/^\d+\.\s*/, ""));
}

function isPortableStateDebris(text: string, context: AdmissionContext): boolean {
  return (
    isUiArtifact(text) ||
    isConversationDebris(text) ||
    isToolChatter(text) ||
    isMetaDirectiveHeading(text) ||
    PROMPT_SHELL_EXPORT_RE.test(text) ||
    isFormattingOnlyInstruction(text) ||
    GENERATED_CARRY_FORWARD_SCAFFOLD_RE.test(cleanLine(text)) ||
    PROMPT_SHELL_LABEL_RE.test(cleanLine(text)) ||
    hasBlendedSectionShell(text) ||
    isQuotedBlockNoise(text) ||
    (isScreenshotDebris(text) && !isScreenshotMissionCritical(context))
  );
}

function filterPortableStateItemsWithStats(
  items: string[],
  context: AdmissionContext
): {
  items: string[];
  considered: number;
  admitted: number;
  rejectedAsShell: number;
} {
  const uniqueItems = uniqueNonEmpty(items);
  const output: string[] = [];
  let rejectedAsShell = 0;

  for (const item of uniqueItems) {
    if (isPortableStateDebris(item, context)) {
      rejectedAsShell += 1;
      recordDiscard(context, item, true);
      continue;
    }
    output.push(truncatePortable(item));
  }

  return {
    items: uniqueMeaningfulStrings(output),
    considered: uniqueItems.length,
    admitted: output.length,
    rejectedAsShell
  };
}

function filterPortableStateItems(items: string[], context: AdmissionContext): string[] {
  return filterPortableStateItemsWithStats(items, context).items;
}

function canonicalizeForTarget(
  text: string,
  target: AdmissionTarget,
  context: AdmissionContext
): string {
  const distilled = distillLongFragment(text, target, context)
    .replace(
      /^(?:decision|constraint|requirement|open question|risk|note|objective|stable core|governance principles?|invariants?|continuity safeguards?|quarantine log|deferred items?|rejected directions?|rejected direction):\s*/i,
      ""
    )
    .trim();
  if (target === "rejected_directions" && text.length !== distilled.length) {
    context.normalizedRejected += 1;
  }
  return distilled;
}

function preferCandidate(current: string, next: string): string {
  const currentScore =
    (current.length <= MAX_PORTABLE_ITEM_LENGTH ? 2 : 0) +
    (OPERATIONAL_VERB_RE.test(current) ? 1 : 0);
  const nextScore =
    (next.length <= MAX_PORTABLE_ITEM_LENGTH ? 2 : 0) + (OPERATIONAL_VERB_RE.test(next) ? 1 : 0);
  if (nextScore > currentScore) return next;
  if (nextScore === currentScore && next.length < current.length) return next;
  return current;
}

function admitCandidates(
  inputs: CandidateInput[],
  target: AdmissionTarget,
  context: AdmissionContext,
  limit: number
): string[] {
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
      if (
        target === "continuity_anchors" &&
        !isIdentityBearing(classified.text) &&
        classified.score < 4
      ) {
        recordDiagnosticOnly(context, classified.text);
        continue;
      }

      const canonical = canonicalizeForTarget(classified.text, target, context);
      if (!canonical || canonical.length < 4) continue;

      const duplicateIndex = output.findIndex((item) =>
        isMeaningfullyDuplicate(item, canonical, 0.74)
      );
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
    ...splitCandidateFragments(text).filter(
      (line) =>
        /\b(implement|evaluate|refine|tighten|fix|build|preserve)\b/i.test(line) &&
        OPERATIONAL_RE.test(line)
    )
  );
  return uniqueMeaningfulStrings(candidates).slice(0, 12);
}

function derivedObjectiveFromMission(missionText: string): string | undefined {
  void missionText;
  return undefined;
}

function isWeakObjective(objective: string): boolean {
  const clean = cleanFragmentText(objective);
  const words = clean.split(/\s+/).filter(Boolean);
  return (
    !clean ||
    clean === "invalid_objective" ||
    PROMPT_SHELL_LABEL_RE.test(clean) ||
    PROMPT_SHELL_EXPORT_RE.test(clean) ||
    isFormattingOnlyInstruction(clean) ||
    hasBlendedSectionShell(clean) ||
    QUESTION_FRAGMENT_OBJECTIVE_RE.test(clean) ||
    words.length <= 3 ||
    /^(hybrid workspace|workspace|continuity|prompt review|review|session|untitled|continue|active session)$/i.test(
      clean
    ) ||
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
  if (
    isConversationDebris(objective) ||
    isUiArtifact(objective) ||
    isMetaDirectiveHeading(objective) ||
    PROMPT_SHELL_LABEL_RE.test(cleanFragmentText(objective)) ||
    PROMPT_SHELL_EXPORT_RE.test(objective) ||
    isFormattingOnlyInstruction(objective) ||
    hasBlendedSectionShell(objective)
  )
    score -= 8;
  return score;
}

function normalizeObjective(
  result: TransformResult,
  transformedText: string,
  context: AdmissionContext
): string {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const current = cleanFragmentText(review.activeObjective);
  const generated = derivedObjectiveFromMission(context.missionText);
  const candidates = uniqueMeaningfulStrings(
    [
      current,
      parsed?.active_objective,
      generated,
      ...objectiveCandidatesFromText(result.originalText),
      ...objectiveCandidatesFromText(result.normalizedText),
      ...objectiveCandidatesFromText(transformedText)
    ].filter(Boolean) as string[]
  );
  const ranked = candidates
    .map((item) => ({ item: truncatePortable(item, 180), score: scoreObjectiveCandidate(item) }))
    .filter(({ item }) => item && !isConversationDebris(item) && !isUiArtifact(item))
    .sort((left, right) => right.score - left.score || left.item.length - right.item.length);
  const best = ranked[0]?.item ?? current;
  const currentScore = scoreObjectiveCandidate(current);
  const bestScore = ranked[0]?.score ?? currentScore;
  const normalized = isWeakObjective(current) || bestScore > currentScore + 2 ? best : current;
  const finalObjective = isWeakObjective(normalized)
    ? "invalid_objective"
    : truncatePortable(normalized, 180);

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

function portableAdmissionSummary(
  diagnostics: AdmittedContinuityState["diagnostics"]
): Record<string, unknown> {
  return {
    warnings: diagnostics.warnings,
    discarded_fragment_count: diagnostics.discarded_fragment_count,
    debris_removed_count: diagnostics.debris_removed_count,
    normalized_rejected_direction_count: diagnostics.normalized_rejected_direction_count,
    objective_normalized: diagnostics.objective_normalized,
    capsule_text_compacted: diagnostics.capsule_text_compacted,
    export_source_mode: diagnostics.export_source_mode,
    session_durable_item_count: diagnostics.session_durable_item_count,
    latest_turn_durable_item_count: diagnostics.latest_turn_durable_item_count,
    durable_items_carried_forward_count: diagnostics.durable_items_carried_forward_count,
    durable_items_overridden_by_latest_turn_count:
      diagnostics.durable_items_overridden_by_latest_turn_count,
    session_items_considered_count: diagnostics.session_items_considered_count,
    session_items_admitted_count: diagnostics.session_items_admitted_count,
    session_items_rejected_as_shell_count: diagnostics.session_items_rejected_as_shell_count,
    fallback_to_latest_turn_only: diagnostics.fallback_to_latest_turn_only,
    session_level_capsule_passed: diagnostics.session_level_capsule_passed,
    quality_gate_blockers: diagnostics.quality_gate_blockers
  };
}

function makeAdmissionContext(result: TransformResult, objectiveHint: string): AdmissionContext {
  return {
    objectiveHint,
    missionText: [
      result.originalText,
      result.normalizedText,
      result.transformedText,
      result.continuityReview.cleanSummary
    ]
      .filter(Boolean)
      .join("\n"),
    diagnosticOnly: [],
    diagnosticKeys: new Set<string>(),
    discardedKeys: new Set<string>(),
    debrisRemoved: 0,
    normalizedRejected: 0
  };
}

function compactTextSection(
  title: string,
  items: string[],
  limit = MAX_CAPSULE_TEXT_ITEMS
): string[] {
  return bulletSection(title, items.slice(0, limit));
}

function portableContinuityText(input: {
  activeObjective: string;
  stableConstraints: string[];
  acceptedDecisions: string[];
  unresolvedIssues: string[];
  rejectedDirections: string[];
  governancePrinciples?: string[];
  invariants?: string[];
  continuitySafeguards?: string[];
  quarantineLog?: string[];
  deferredItems?: string[];
  conditionalAdmissions?: string[];
  continuityAnchors: string[];
  mutationTargets?: MutationTarget[];
  provisionalState?: string[];
  includeProvisional?: boolean;
}): string {
  const sections = [
    ["Continuity Review"],
    ["Active Objective", input.activeObjective],
    bulletSection(
      "Stable Constraints",
      input.stableConstraints.slice(0, MAX_PORTABLE_CONTEXT_ITEMS),
      "No stable constraints admitted."
    ),
    bulletSection(
      "Accepted Decisions",
      input.acceptedDecisions.slice(0, MAX_PORTABLE_CONTEXT_ITEMS)
    ),
    bulletSection("Open / Unresolved", input.unresolvedIssues.slice(0, MAX_PORTABLE_CONTEXT_ITEMS)),
    bulletSection(
      "Rejected Directions",
      input.rejectedDirections.slice(0, MAX_PORTABLE_CONTEXT_ITEMS)
    ),
    bulletSection(
      "Governance Principles",
      input.governancePrinciples?.slice(0, MAX_PORTABLE_CONTEXT_ITEMS) ?? []
    ),
    bulletSection("Invariants", input.invariants?.slice(0, MAX_PORTABLE_CONTEXT_ITEMS) ?? []),
    bulletSection(
      "Continuity Safeguards",
      input.continuitySafeguards?.slice(0, MAX_PORTABLE_CONTEXT_ITEMS) ?? []
    ),
    bulletSection("Quarantine Log", input.quarantineLog?.slice(0, 4) ?? []),
    bulletSection("Deferred Items", input.deferredItems?.slice(0, 4) ?? []),
    bulletSection("Conditional Admissions", input.conditionalAdmissions?.slice(0, 4) ?? []),
    bulletSection(
      "Mutation Targets",
      (input.mutationTargets ?? [])
        .map((item) => String(item.attempted_mutation ?? item.target_component ?? ""))
        .filter(Boolean)
        .slice(0, 4)
    ),
    bulletSection(
      "Continuity Anchors",
      input.continuityAnchors.slice(0, MAX_PORTABLE_CONTEXT_ITEMS)
    ),
    input.includeProvisional
      ? bulletSection("New / Provisional", input.provisionalState?.slice(0, 4) ?? [])
      : []
  ];
  return sections
    .filter((section) => section.length)
    .map((section) => section.join("\n"))
    .join("\n\n");
}

function buildLatestAdmittedState(
  result: TransformResult,
  transformedText: string
): AdmittedContinuityState {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const adversarialGovernance = review.diagnostics.adversarialGovernance;
  const preliminaryObjective = cleanFragmentText(review.activeObjective);
  const context = makeAdmissionContext(result, preliminaryObjective);
  const activeObjective = normalizeObjective(result, transformedText, context);
  context.objectiveHint = activeObjective;

  const stableConstraints = admitCandidates(
    [
      ...candidatesFrom(
        result.extractedConstraints
          .map((constraint) => constraint.text)
          .filter((text) => !isLabeledNonStableState(text)),
        "extracted_constraints"
      ),
      ...candidatesFrom(
        parsed?.stable_constraints ?? [],
        "parsed_capsule.stable_constraints",
        "operational_constraint"
      ),
      ...candidatesFrom(review.stableCore, "continuity_review.stable_core")
    ],
    "stable_constraints",
    context,
    12
  );
  const acceptedDecisions = admitCandidates(
    [
      ...candidatesFrom(
        parsed?.accepted_decisions ?? [],
        "parsed_capsule.accepted_decisions",
        "accepted_decision"
      ),
      ...candidatesFrom(review.whatChanged, "continuity_review.what_changed")
    ],
    "accepted_decisions",
    context,
    8
  );
  const unresolvedIssues = admitCandidates(
    [
      ...candidatesFrom(
        parsed?.open_questions ?? [],
        "parsed_capsule.open_questions",
        "unresolved_tension"
      ),
      ...candidatesFrom(
        parsed?.unresolved_risks ?? [],
        "parsed_capsule.unresolved_risks",
        "unresolved_tension"
      ),
      ...candidatesFrom(
        review.openUnresolved,
        "continuity_review.open_unresolved",
        "unresolved_tension"
      )
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
      ...candidatesFrom(
        adversarialGovernance?.rejected_directions ?? [],
        "diagnostics.adversarial_governance.rejected_directions",
        "rejected_direction"
      ),
      ...candidatesFrom(stableConstraints, "admitted.stable_constraints"),
      ...candidatesFrom(parsed?.stable_constraints ?? [], "parsed_capsule.stable_constraints"),
      ...candidatesFrom(review.stableCore, "continuity_review.stable_core"),
      ...candidatesFrom(
        result.extractedConstraints.map((constraint) => constraint.text),
        "extracted_constraints"
      )
    ],
    "rejected_directions",
    context,
    8
  );
  const governancePrinciples = filterPortableStateItems(
    [
      ...(adversarialGovernance?.governance_principles ?? []),
      ...(review.diagnostics.governance_principles ?? [])
    ],
    context
  ).slice(0, MAX_PORTABLE_CONTEXT_ITEMS);
  const invariants = filterPortableStateItems(
    [...(adversarialGovernance?.invariants ?? []), ...(review.diagnostics.invariants ?? [])],
    context
  ).slice(0, MAX_PORTABLE_CONTEXT_ITEMS);
  const continuitySafeguards = filterPortableStateItems(
    [
      ...(adversarialGovernance?.continuity_safeguards ?? []),
      ...(review.diagnostics.continuity_safeguards ?? [])
    ],
    context
  ).slice(0, MAX_PORTABLE_CONTEXT_ITEMS);
  const quarantineLog = filterPortableStateItems(
    [
      ...(adversarialGovernance?.quarantine_log ?? []),
      ...(review.diagnostics.quarantined_items ?? [])
    ],
    context
  ).slice(0, MAX_PORTABLE_CONTEXT_ITEMS);
  const deferredItems = filterPortableStateItems(
    [
      ...(adversarialGovernance?.deferred_items.map((item) => item.text) ?? []),
      ...(review.diagnostics.deferred_items ?? [])
    ],
    context
  ).slice(0, MAX_PORTABLE_CONTEXT_ITEMS);
  const conditionalAdmissions = filterPortableStateItems(
    [
      ...(adversarialGovernance?.conditional_admissions.map((item) => item.text) ?? []),
      ...(review.diagnostics.conditional_admissions ?? [])
    ],
    context
  ).slice(0, MAX_PORTABLE_CONTEXT_ITEMS);
  const mutationTargets = (adversarialGovernance?.mutation_targets ?? []).slice(0, 8);
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
  const recommendedNextActions = admitCandidates(
    candidatesFrom(review.recommendedNextActions, "continuity_review.recommended_next_actions"),
    "workflow_evolution",
    context,
    4
  );
  const carryForwardContext = portableContinuityText({
    activeObjective,
    stableConstraints,
    acceptedDecisions,
    unresolvedIssues,
    rejectedDirections,
    governancePrinciples,
    invariants,
    continuitySafeguards,
    quarantineLog,
    deferredItems,
    conditionalAdmissions,
    mutationTargets,
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
    ...compactTextSection("Governance Principles", governancePrinciples, 2),
    ...compactTextSection("Invariants", invariants, 2),
    ...compactTextSection("Continuity Safeguards", continuitySafeguards, 2),
    ...compactTextSection("Quarantine Log", quarantineLog, 2),
    ...compactTextSection("Deferred Items", deferredItems, 2),
    ...compactTextSection("Continuity Anchors", continuityAnchors, 2),
    ...compactTextSection("Recommended Next Actions", recommendedNextActions, 2)
  ]
    .filter(Boolean)
    .join("\n");
  const rawNotesLength = [
    review.cleanSummary,
    ...review.newProvisional,
    ...review.recommendedNextActions,
    transformedText
  ].join("\n").length;
  if (capsuleText.length < rawNotesLength) {
    context.compactedCapsuleText = { before: rawNotesLength, after: capsuleText.length };
  }
  const latestDurableItemCount = countDurableItems({
    activeObjective,
    stableConstraints,
    acceptedDecisions,
    unresolvedIssues,
    rejectedDirections,
    governancePrinciples,
    invariants,
    continuitySafeguards,
    provisionalState
  });
  const qualityGateBlockers = uniqueNonEmpty([
    isWeakObjective(activeObjective) || isPortableStateDebris(activeObjective, context)
      ? "invalid_objective"
      : "",
    result.continuityReview.diagnostics.export_readiness_decision === "UNSAFE_FOR_HANDOFF"
      ? "review artifact is unsafe for handoff"
      : ""
  ]);

  return {
    activeObjective,
    stableConstraints,
    acceptedDecisions,
    unresolvedIssues,
    rejectedDirections,
    governancePrinciples,
    invariants,
    continuitySafeguards,
    quarantineLog,
    deferredItems,
    conditionalAdmissions,
    mutationTargets,
    continuityAnchors,
    provisionalState,
    workflowEvolution,
    recommendedNextActions,
    carryForwardContext,
    capsuleText,
    diagnostics: {
      warnings: buildAdmissionWarnings(context),
      diagnostic_only_fragments: context.diagnosticOnly.slice(0, 20),
      discarded_fragment_count: context.discardedKeys.size,
      debris_removed_count: context.debrisRemoved,
      normalized_rejected_direction_count: context.normalizedRejected,
      objective_normalized: context.objectiveNormalized,
      capsule_text_compacted: context.compactedCapsuleText,
      export_source_mode: "latest_turn_admitted",
      session_durable_item_count: 0,
      latest_turn_durable_item_count: latestDurableItemCount,
      durable_items_carried_forward_count: 0,
      durable_items_overridden_by_latest_turn_count: 0,
      session_items_considered_count: 0,
      session_items_admitted_count: 0,
      session_items_rejected_as_shell_count: 0,
      fallback_to_latest_turn_only: true,
      session_level_capsule_passed: qualityGateBlockers.length === 0,
      quality_gate_blockers: qualityGateBlockers
    }
  };
}

function countDurableItems(state: Pick<
  AdmittedContinuityState,
  | "activeObjective"
  | "stableConstraints"
  | "acceptedDecisions"
  | "unresolvedIssues"
  | "rejectedDirections"
  | "governancePrinciples"
  | "invariants"
  | "continuitySafeguards"
  | "provisionalState"
>): number {
  return [
    isWeakObjective(state.activeObjective) ? "" : state.activeObjective,
    ...state.stableConstraints,
    ...state.acceptedDecisions,
    ...state.unresolvedIssues,
    ...state.rejectedDirections,
    ...state.governancePrinciples,
    ...state.invariants,
    ...state.continuitySafeguards,
    ...state.provisionalState
  ].filter(Boolean).length;
}

function sessionStateHasRicherDurability(
  sessionState: SessionGovernanceState | null | undefined
): boolean {
  return Boolean(
    sessionState &&
      countDurableItems({
        activeObjective: sessionState.stableCore.objective,
        stableConstraints: sessionState.stableCore.hardConstraints,
        acceptedDecisions: sessionState.stableCore.acceptedDecisions,
        unresolvedIssues: sessionState.opennessLane.openQuestions,
        rejectedDirections: sessionState.rejectedDirections ?? [],
        governancePrinciples: sessionState.governancePrinciples ?? [],
        invariants: sessionState.invariants ?? [],
        continuitySafeguards: sessionState.continuitySafeguards ?? [],
        provisionalState: sessionState.noveltyLane.map((item) => item.text)
      }) > 0
  );
}

interface SessionBucketAdmission {
  items: string[];
  considered: number;
  admitted: number;
  rejectedAsShell: number;
}

function admitSessionItems(
  sessionItems: string[] | undefined,
  context: AdmissionContext,
  limit: number
): SessionBucketAdmission {
  const filtered = filterPortableStateItemsWithStats(sessionItems ?? [], context);
  return {
    ...filtered,
    items: filtered.items.slice(0, limit)
  };
}

function mergeAdmittedItems(
  sessionItems: string[],
  latestItems: string[],
  context: AdmissionContext,
  limit: number
): string[] {
  const latestClean = filterPortableStateItems(latestItems, context);
  return uniqueMeaningfulStrings([...sessionItems, ...latestClean]).slice(0, limit);
}

function carriedForwardCount(sessionItems: string[], finalItems: string[]): number {
  return sessionItems.filter((sessionItem) =>
    finalItems.some((finalItem) => isMeaningfullyDuplicate(sessionItem, finalItem, 0.74))
  ).length;
}

function latestOverrideCount(sessionItems: string[], latestItems: string[], finalItems: string[]): number {
  if (!sessionItems.length) return 0;
  return latestItems.filter(
    (latestItem) =>
      finalItems.some((finalItem) => isMeaningfullyDuplicate(latestItem, finalItem, 0.74)) &&
      !sessionItems.some((sessionItem) => isMeaningfullyDuplicate(sessionItem, latestItem, 0.74))
  ).length;
}

function buildSessionSourcedState(
  latest: AdmittedContinuityState,
  sessionState: SessionGovernanceState,
  result: TransformResult
): AdmittedContinuityState {
  const context = makeAdmissionContext(result, sessionState.stableCore.objective);
  const sessionObjective = cleanFragmentText(sessionState.stableCore.objective);
  const sessionObjectiveIsAdmitted = Boolean(
    sessionObjective && !isWeakObjective(sessionObjective) && !isPortableStateDebris(sessionObjective, context)
  );
  const activeObjective =
    sessionObjectiveIsAdmitted ? sessionObjective : latest.activeObjective;
  const sessionStableConstraints = admitSessionItems(
    sessionState.stableCore.hardConstraints,
    context,
    12
  );
  const stableConstraints = mergeAdmittedItems(
    sessionStableConstraints.items,
    latest.stableConstraints,
    context,
    12
  );
  const sessionAcceptedDecisions = admitSessionItems(
    sessionState.stableCore.acceptedDecisions,
    context,
    8
  );
  const acceptedDecisions = mergeAdmittedItems(
    sessionAcceptedDecisions.items,
    latest.acceptedDecisions,
    context,
    8
  );
  const sessionUnresolvedIssues = admitSessionItems(
    [...sessionState.opennessLane.openQuestions, ...sessionState.opennessLane.uncertaintyNotes],
    context,
    10
  );
  const unresolvedIssues = mergeAdmittedItems(
    sessionUnresolvedIssues.items,
    latest.unresolvedIssues,
    context,
    10
  );
  const sessionRejectedDirections = admitSessionItems(sessionState.rejectedDirections, context, 8);
  const rejectedDirections = mergeAdmittedItems(
    sessionRejectedDirections.items,
    latest.rejectedDirections,
    context,
    8
  );
  const sessionGovernancePrinciples = admitSessionItems(
    sessionState.governancePrinciples,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const governancePrinciples = mergeAdmittedItems(
    sessionGovernancePrinciples.items,
    latest.governancePrinciples,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const sessionInvariants = admitSessionItems(
    sessionState.invariants,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const invariants = mergeAdmittedItems(
    sessionInvariants.items,
    latest.invariants,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const sessionContinuitySafeguards = admitSessionItems(
    sessionState.continuitySafeguards,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const continuitySafeguards = mergeAdmittedItems(
    sessionContinuitySafeguards.items,
    latest.continuitySafeguards,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const sessionQuarantineLog = admitSessionItems(
    sessionState.quarantineLog,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const quarantineLog = mergeAdmittedItems(
    sessionQuarantineLog.items,
    latest.quarantineLog,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const sessionDeferredItems = admitSessionItems(
    sessionState.deferredItems,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const deferredItems = mergeAdmittedItems(
    sessionDeferredItems.items,
    latest.deferredItems,
    context,
    MAX_PORTABLE_CONTEXT_ITEMS
  );
  const sessionProvisionalState = admitSessionItems(
    sessionState.noveltyLane.filter((item) => !item.accepted).map((item) => item.text),
    context,
    8
  );
  const provisionalState = mergeAdmittedItems(
    sessionProvisionalState.items,
    latest.provisionalState,
    context,
    8
  );
  const sessionAdmissionBuckets = [
    sessionStableConstraints,
    sessionAcceptedDecisions,
    sessionUnresolvedIssues,
    sessionRejectedDirections,
    sessionGovernancePrinciples,
    sessionInvariants,
    sessionContinuitySafeguards,
    sessionQuarantineLog,
    sessionDeferredItems,
    sessionProvisionalState
  ];
  const sessionItemsConsideredCount =
    (sessionObjective ? 1 : 0) +
    sessionAdmissionBuckets.reduce((sum, bucket) => sum + bucket.considered, 0);
  const sessionItemsAdmittedCount =
    (sessionObjectiveIsAdmitted ? 1 : 0) +
    sessionAdmissionBuckets.reduce((sum, bucket) => sum + bucket.admitted, 0);
  const sessionItemsRejectedAsShellCount =
    (sessionObjective && !sessionObjectiveIsAdmitted ? 1 : 0) +
    sessionAdmissionBuckets.reduce((sum, bucket) => sum + bucket.rejectedAsShell, 0);
  const mutationTargets = sessionState.mutationTargets?.slice(0, 8) ?? [];
  const continuityAnchors = admitCandidates(
    [
      candidate(activeObjective, "session.active_objective", "continuity_anchor"),
      candidate(sessionState.title, "session.title", "continuity_anchor"),
      ...candidatesFrom(stableConstraints, "session.stable_constraints"),
      ...candidatesFrom(acceptedDecisions, "session.accepted_decisions")
    ],
    "continuity_anchors",
    context,
    10
  );
  const workflowEvolution = latest.workflowEvolution;
  const recommendedNextActions = latest.recommendedNextActions;
  const carryForwardContext = portableContinuityText({
    activeObjective,
    stableConstraints,
    acceptedDecisions,
    unresolvedIssues,
    rejectedDirections,
    governancePrinciples,
    invariants,
    continuitySafeguards,
    quarantineLog,
    deferredItems,
    conditionalAdmissions: [],
    mutationTargets,
    continuityAnchors,
    provisionalState,
    includeProvisional: true
  });
  const capsuleText = [
    "Saved from accumulated session durable state.",
    `Objective: ${activeObjective}`,
    ...compactTextSection("Stable Constraints", stableConstraints),
    ...compactTextSection("Accepted Decisions", acceptedDecisions),
    ...compactTextSection("Open / Unresolved", unresolvedIssues),
    ...compactTextSection("Rejected Directions", rejectedDirections, 2),
    ...compactTextSection("Governance Principles", governancePrinciples, 2),
    ...compactTextSection("Invariants", invariants, 2),
    ...compactTextSection("Continuity Safeguards", continuitySafeguards, 2),
    ...compactTextSection("Quarantine Log", quarantineLog, 2),
    ...compactTextSection("Deferred Items", deferredItems, 2),
    ...compactTextSection("Continuity Anchors", continuityAnchors, 2),
    ...compactTextSection("Recommended Next Actions", recommendedNextActions, 2)
  ]
    .filter(Boolean)
    .join("\n");

  const finalState = {
    activeObjective,
    stableConstraints,
    acceptedDecisions,
    unresolvedIssues,
    rejectedDirections,
    governancePrinciples,
    invariants,
    continuitySafeguards,
    provisionalState
  };
  const sessionStateShape = {
    activeObjective: sessionState.stableCore.objective,
    stableConstraints: sessionState.stableCore.hardConstraints,
    acceptedDecisions: sessionState.stableCore.acceptedDecisions,
    unresolvedIssues: sessionState.opennessLane.openQuestions,
    rejectedDirections: sessionState.rejectedDirections ?? [],
    governancePrinciples: sessionState.governancePrinciples ?? [],
    invariants: sessionState.invariants ?? [],
    continuitySafeguards: sessionState.continuitySafeguards ?? [],
    provisionalState: sessionState.noveltyLane.map((item) => item.text)
  };
  const latestStateShape = {
    activeObjective: latest.activeObjective,
    stableConstraints: latest.stableConstraints,
    acceptedDecisions: latest.acceptedDecisions,
    unresolvedIssues: latest.unresolvedIssues,
    rejectedDirections: latest.rejectedDirections,
    governancePrinciples: latest.governancePrinciples,
    invariants: latest.invariants,
    continuitySafeguards: latest.continuitySafeguards,
    provisionalState: latest.provisionalState
  };
  const sessionDurableItemCount = countDurableItems(sessionStateShape);
  const latestTurnDurableItemCount = countDurableItems(latestStateShape);
  const finalDurableItemCount = countDurableItems(finalState);
  const sessionDurableItems = [
    sessionStateShape.activeObjective,
    ...sessionStateShape.stableConstraints,
    ...sessionStateShape.acceptedDecisions,
    ...sessionStateShape.unresolvedIssues,
    ...sessionStateShape.rejectedDirections,
    ...sessionStateShape.governancePrinciples,
    ...sessionStateShape.invariants,
    ...sessionStateShape.continuitySafeguards,
    ...sessionStateShape.provisionalState
  ].filter(Boolean);
  const finalDurableItems = [
    activeObjective,
    ...stableConstraints,
    ...acceptedDecisions,
    ...unresolvedIssues,
    ...rejectedDirections,
    ...governancePrinciples,
    ...invariants,
    ...continuitySafeguards,
    ...provisionalState
  ].filter(Boolean);
  const latestDurableItems = [
    latestStateShape.activeObjective,
    ...latestStateShape.stableConstraints,
    ...latestStateShape.acceptedDecisions,
    ...latestStateShape.unresolvedIssues,
    ...latestStateShape.rejectedDirections,
    ...latestStateShape.governancePrinciples,
    ...latestStateShape.invariants,
    ...latestStateShape.continuitySafeguards,
    ...latestStateShape.provisionalState
  ].filter(Boolean);
  const durableItemsCarriedForwardCount = carriedForwardCount(
    sessionDurableItems,
    finalDurableItems
  );
  const durableItemsOverriddenByLatestTurnCount = latestOverrideCount(
    sessionDurableItems,
    latestDurableItems,
    finalDurableItems
  );
  const fallbackToLatestTurnOnly =
    sessionDurableItemCount > latestTurnDurableItemCount &&
    durableItemsCarriedForwardCount === 0 &&
    finalDurableItemCount <= latestTurnDurableItemCount;
  const qualityGateBlockers = uniqueNonEmpty([
    isWeakObjective(activeObjective) || isPortableStateDebris(activeObjective, context)
      ? "invalid_objective"
      : "",
    sessionGovernancePrinciples.items.length > 0 && !governancePrinciples.length
      ? "session governance was not preserved"
      : "",
    sessionRejectedDirections.items.length > 0 && !rejectedDirections.length
      ? "session rejected directions were not preserved"
      : "",
    sessionUnresolvedIssues.items.length > 0 && !unresolvedIssues.length
      ? "session unresolved issues were not preserved"
      : "",
    sessionContinuitySafeguards.items.length > 0 && !continuitySafeguards.length
      ? "session safeguards were not preserved"
      : "",
    fallbackToLatestTurnOnly ? "export collapsed to latest-turn-only state" : "",
    finalDurableItemCount < Math.min(3, sessionDurableItemCount)
      ? "final artifact is too shallow for session continuity"
      : ""
  ]);
  const sessionLevelCapsulePassed = qualityGateBlockers.length === 0;
  const exportSourceMode = fallbackToLatestTurnOnly
    ? "blocked_last_turn_only"
    : sessionDurableItemCount > durableItemsCarriedForwardCount
      ? "session_durable_state_with_latest_fill"
      : "session_durable_state";

  return {
    activeObjective,
    stableConstraints,
    acceptedDecisions,
    unresolvedIssues,
    rejectedDirections,
    governancePrinciples,
    invariants,
    continuitySafeguards,
    quarantineLog,
    deferredItems,
    conditionalAdmissions: [],
    mutationTargets,
    continuityAnchors,
    provisionalState,
    workflowEvolution,
    recommendedNextActions,
    carryForwardContext,
    capsuleText,
    diagnostics: {
      ...latest.diagnostics,
      warnings: uniqueNonEmpty([
        ...latest.diagnostics.warnings,
        sessionLevelCapsulePassed
          ? "Portable export assembled from accumulated session durable state."
          : "Portable export failed session-level capsule quality gate."
      ]),
      export_source_mode: exportSourceMode,
      session_durable_item_count: sessionDurableItemCount,
      latest_turn_durable_item_count: latestTurnDurableItemCount,
      durable_items_carried_forward_count: durableItemsCarriedForwardCount,
      durable_items_overridden_by_latest_turn_count: durableItemsOverriddenByLatestTurnCount,
      session_items_considered_count: sessionItemsConsideredCount,
      session_items_admitted_count: sessionItemsAdmittedCount,
      session_items_rejected_as_shell_count: sessionItemsRejectedAsShellCount,
      fallback_to_latest_turn_only: fallbackToLatestTurnOnly,
      session_level_capsule_passed: sessionLevelCapsulePassed,
      quality_gate_blockers: qualityGateBlockers
    }
  };
}

function buildAdmittedState(
  result: TransformResult,
  transformedText: string,
  sessionState?: SessionGovernanceState | null
): AdmittedContinuityState {
  const latest = buildLatestAdmittedState(result, transformedText);
  if (!sessionState || !sessionStateHasRicherDurability(sessionState)) {
    return {
      ...latest,
      diagnostics: {
        ...latest.diagnostics,
        latest_turn_durable_item_count: countDurableItems(latest),
        fallback_to_latest_turn_only: true
      }
    };
  }
  return buildSessionSourcedState(latest, sessionState, result);
}

function compactGovernanceSummary(
  sessionState: SessionGovernanceState | null
): Record<string, unknown> {
  if (!sessionState) {
    return {};
  }
  const objective = cleanFragmentText(sessionState.stableCore.objective);
  const cleanStoredItems = (items: string[] | undefined): string[] =>
    uniqueMeaningfulStrings(
      uniqueNonEmpty(items ?? [])
        .filter(
          (item) =>
            !PROMPT_SHELL_EXPORT_RE.test(item) &&
            !PROMPT_SHELL_LABEL_RE.test(cleanLine(item)) &&
            !GENERATED_CARRY_FORWARD_SCAFFOLD_RE.test(cleanLine(item)) &&
            !hasBlendedSectionShell(item)
        )
        .map((item) => truncatePortable(item))
    );
  return {
    session_id: sessionState.id,
    title: sessionState.title,
    stable_core: {
      ...sessionState.stableCore,
      objective: objective && !isWeakObjective(objective) ? objective : "invalid_objective",
      hardConstraints: cleanStoredItems(sessionState.stableCore.hardConstraints),
      acceptedDecisions: cleanStoredItems(sessionState.stableCore.acceptedDecisions)
    },
    openness: {
      ...sessionState.opennessLane,
      openQuestions: cleanStoredItems(sessionState.opennessLane.openQuestions),
      uncertaintyNotes: cleanStoredItems(sessionState.opennessLane.uncertaintyNotes)
    },
    monitors: sessionState.monitors
  };
}

function cleanContinuityReview(
  review: TransformResult["continuityReview"],
  admitted: AdmittedContinuityState
): Record<string, unknown> {
  return {
    clean_summary: review.cleanSummary,
    active_objective: admitted.activeObjective,
    stable_core: admitted.stableConstraints,
    accepted_decisions: admitted.acceptedDecisions,
    provisional_state: admitted.provisionalState,
    open_unresolved: admitted.unresolvedIssues,
    rejected_directions: admitted.rejectedDirections,
    governance_principles: admitted.governancePrinciples,
    invariants: admitted.invariants,
    continuity_safeguards: admitted.continuitySafeguards,
    quarantine_log: admitted.quarantineLog,
    deferred_items: admitted.deferredItems,
    conditional_admissions: admitted.conditionalAdmissions,
    mutation_targets: admitted.mutationTargets,
    what_changed: admitted.workflowEvolution,
    recommended_next_actions: admitted.recommendedNextActions
  };
}

function cleanContinuityStateHistory(admitted: AdmittedContinuityState): Record<string, unknown>[] {
  return [
    {
      source: "continuity_review",
      active_objective: admitted.activeObjective,
      stable_core_count: admitted.stableConstraints.length,
      unresolved_count: admitted.unresolvedIssues.length,
      rejected_count: admitted.rejectedDirections.length,
      quarantine_count: admitted.quarantineLog.length,
      mutation_target_count: admitted.mutationTargets.length,
      admission_warnings: admitted.diagnostics.warnings
    }
  ];
}

function scoreSummary(result: TransformResult): Record<string, number | undefined> {
  return {
    compactness_score: result.scores.compactnessScore,
    constraint_preservation_score: result.scores.constraintPreservationScore,
    source_purity_score: result.scores.sourcePurityScore,
    bucket_exclusivity_score: result.scores.bucketExclusivityScore,
    chrome_contamination_score: result.scores.chromeContaminationScore,
    assistant_contamination_score: result.scores.assistantContaminationScore,
    durable_state_precision: result.scores.durableStatePrecision,
    durable_state_recall: result.scores.durableStateRecall,
    durable_recall_estimate: result.scores.durableRecallEstimate,
    task_local_leakage_score: result.scores.taskLocalLeakageScore,
    governance_detection_completeness: result.scores.governanceDetectionCompleteness,
    invariant_detection_completeness: result.scores.invariantDetectionCompleteness,
    safeguard_detection_completeness: result.scores.safeguardDetectionCompleteness,
    negative_state_preservation: result.scores.negativeStatePreservation,
    rejected_direction_recall: result.scores.rejectedDirectionRecall,
    unresolved_tension_recall: result.scores.unresolvedTensionRecall,
    export_readiness: result.scores.exportReadiness,
    review_truthfulness: result.scores.reviewTruthfulness,
    risk_score: result.scores.riskScore,
    redundancy_before: result.scores.redundancyScoreBefore,
    redundancy_after: result.scores.redundancyScoreAfter,
    mode_alignment_score: result.scores.modeAlignmentScore,
    adaptation_alignment_score: result.scores.adaptationAlignmentScore
  };
}

function finalTruthFromAdmitted(
  result: TransformResult,
  admitted: AdmittedContinuityState
): FinalArtifactTruth {
  const review = result.continuityReview;
  const rawDecision = review.diagnostics.export_readiness_decision ?? "UNSAFE_FOR_HANDOFF";
  const finalBlockers = uniqueNonEmpty([
    ...(review.diagnostics.readiness_blockers ?? []),
    ...admitted.diagnostics.quality_gate_blockers
  ]);
  const finalDecision: HandoffDecision =
    rawDecision === "UNSAFE_FOR_HANDOFF" || finalBlockers.length > 0
      ? "UNSAFE_FOR_HANDOFF"
      : "SAFE_FOR_HANDOFF";
  const finalDurableCount = countDurableItems(admitted);

  return {
    final_artifact_source_mode: admitted.diagnostics.export_source_mode,
    final_artifact_objective: admitted.activeObjective,
    final_evaluated_objective: admitted.activeObjective,
    final_artifact_durable_count: finalDurableCount,
    final_artifact_durable_item_count: finalDurableCount,
    final_artifact_readiness_decision: finalDecision,
    final_export_readiness_decision: finalDecision,
    final_artifact_blockers: finalBlockers,
    final_readiness_blockers: finalBlockers,
    final_missing_state_summary: review.diagnostics.missing_state_summary ?? [],
    session_items_considered_count: admitted.diagnostics.session_items_considered_count,
    session_items_admitted_count: admitted.diagnostics.session_items_admitted_count,
    session_items_rejected_as_shell_count:
      admitted.diagnostics.session_items_rejected_as_shell_count,
    review_export_truth_match: true
  };
}

export function buildFinalArtifactTruth(
  context: Pick<ReviewArtifactContext, "result" | "transformedText" | "sessionState">
): FinalArtifactTruth {
  const admitted = buildAdmittedState(context.result, context.transformedText, context.sessionState);
  return finalTruthFromAdmitted(context.result, admitted);
}

function diagnosticMetadata(
  result: TransformResult,
  transformedText: string,
  extensionVersion?: string,
  admitted?: AdmittedContinuityState
): Record<string, unknown> {
  const buildProvenance =
    result.continuityReview.diagnostics.build_provenance ??
    getBuildProvenance(extensionVersion);
  const truth = admitted ? finalTruthFromAdmitted(result, admitted) : undefined;
  const finalReadinessDecision =
    truth?.final_artifact_readiness_decision ??
    result.continuityReview.diagnostics.export_readiness_decision ??
    "UNSAFE_FOR_HANDOFF";
  return {
    build_provenance: buildProvenance,
    source_surface: sourcePlatform(result),
    target_model: result.targetModelApplied ?? result.continuityReview.diagnostics.targetModel,
    requested_mode: result.continuityReview.diagnostics.requestedMode,
    mode_applied: result.modeApplied,
    pipeline_steps: result.continuityReview.diagnostics.pipelineSteps,
    provider_profile: result.continuityReview.diagnostics.providerProfile,
    provider_health: result.continuityReview.diagnostics.providerHealth,
    runtime_snapshot: result.continuityReview.diagnostics.runtime_snapshot,
    retrieval_context: result.continuityReview.diagnostics.retrievalContext,
    mutation_risk_report: result.continuityReview.diagnostics.mutation_risk_report,
    metric_warnings: result.continuityReview.diagnostics.metric_warnings,
    fidelity_severity: result.continuityReview.diagnostics.fidelity_severity,
    extraction_failure: result.continuityReview.diagnostics.extraction_failure,
    likely_missing_categories: result.continuityReview.diagnostics.likely_missing_categories,
    compression_loss: result.continuityReview.diagnostics.compression_loss,
    export_readiness_decision: finalReadinessDecision,
    review_readiness_decision: finalReadinessDecision,
    raw_review_readiness_decision: result.continuityReview.diagnostics.export_readiness_decision,
    readiness_blockers: result.continuityReview.diagnostics.readiness_blockers,
    readiness_metadata: result.continuityReview.diagnostics.readiness_metadata,
    missing_state_summary: result.continuityReview.diagnostics.missing_state_summary,
    admission_counts: result.continuityReview.diagnostics.admission_counts,
    admission_counts_by_source_role:
      result.continuityReview.diagnostics.admission_counts_by_source_role,
    quarantined_counts_by_source_role:
      result.continuityReview.diagnostics.quarantined_counts_by_source_role,
    task_local_instructions: result.continuityReview.diagnostics.task_local_instructions,
    task_local_forbidden: result.continuityReview.diagnostics.task_local_forbidden,
    raw_input_length: result.originalText.length,
    normalized_length: result.normalizedText.length,
    transformed_length: transformedText.length,
    final_artifact_source_mode: truth?.final_artifact_source_mode,
    final_artifact_objective: truth?.final_artifact_objective,
    final_artifact_durable_count: truth?.final_artifact_durable_count,
    final_artifact_durable_item_count: truth?.final_artifact_durable_item_count,
    final_evaluated_objective: truth?.final_evaluated_objective,
    final_missing_state_summary: truth?.final_missing_state_summary ?? [],
    final_artifact_readiness_decision: truth?.final_artifact_readiness_decision,
    final_export_readiness_decision: finalReadinessDecision,
    final_artifact_blockers: truth?.final_artifact_blockers ?? [],
    final_readiness_blockers: truth?.final_readiness_blockers ?? [],
    session_items_considered_count: truth?.session_items_considered_count ?? 0,
    session_items_admitted_count: truth?.session_items_admitted_count ?? 0,
    session_items_rejected_as_shell_count: truth?.session_items_rejected_as_shell_count ?? 0,
    review_export_truth_match: truth?.review_export_truth_match ?? false,
    scores: scoreSummary(result),
    extension_version: extensionVersion,
    build_timestamp: buildProvenance.build_timestamp,
    commit_sha: buildProvenance.commit_sha,
    environment_tag: buildProvenance.environment_tag
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

export function formatContinuityExport(
  result: TransformResult,
  transformedText: string,
  sessionState?: SessionGovernanceState | null
): string {
  const admitted = buildAdmittedState(result, transformedText, sessionState);
  const truth = finalTruthFromAdmitted(result, admitted);
  const cleanedTransformedText = transformedText
    .split("\n")
    .map((line) => scrubProviderChromeTokens(line))
    .filter((line) => !isUiArtifact(line))
    .join("\n")
    .trim();
  const sections = [
    ["Continuity Review"],
    [
      "Handoff Readiness",
      truth.final_artifact_readiness_decision,
      ...truth.final_artifact_blockers.map((blocker) => `Blocker: ${blocker}`)
    ],
    ["Active Objective", admitted.activeObjective],
    bulletSection(
      "Stable Core",
      uniqueNonEmpty([...admitted.stableConstraints, ...admitted.acceptedDecisions]),
      "No stable constraints or accepted decisions detected."
    ),
    bulletSection(
      "New / Provisional",
      admitted.provisionalState,
      "No new provisional changes detected."
    ),
    bulletSection("Open / Unresolved", admitted.unresolvedIssues),
    bulletSection(
      "Rejected Directions",
      admitted.rejectedDirections,
      "No rejected directions detected."
    ),
    bulletSection(
      "Governance Principles",
      admitted.governancePrinciples,
      "No governance principles detected."
    ),
    bulletSection("Invariants", admitted.invariants, "No invariants detected."),
    bulletSection(
      "Continuity Safeguards",
      admitted.continuitySafeguards,
      "No continuity safeguards detected."
    ),
    bulletSection(
      "Quarantine / Deferred",
      [...admitted.quarantineLog, ...admitted.deferredItems],
      "No quarantined or deferred items detected."
    ),
    bulletSection(
      "Mutation Risk",
      admitted.mutationTargets.map(
        (item) => `${item.target_component}: ${item.attempted_mutation} (${item.risk_level})`
      ),
      "No mutation risks detected."
    ),
    bulletSection("Recommended Next Actions", admitted.recommendedNextActions),
    cleanedTransformedText ? ["Transformed Continuity Draft", cleanedTransformedText] : []
  ];

  return sections
    .filter((section) => section.length)
    .map((section) => section.join("\n"))
    .join("\n\n");
}

export function buildWorkflowDraft(
  result: TransformResult,
  transformedText: string,
  sessionState?: SessionGovernanceState | null
): WorkflowDraft {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const admitted = buildAdmittedState(result, transformedText, sessionState);
  const truth = finalTruthFromAdmitted(result, admitted);
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
    objective: admitted.activeObjective,
    mode: result.modeApplied ?? parsed?.preferred_mode ?? "precision",
    constraints: stableConstraints,
    stable_constraints: stableConstraints,
    accepted_decisions: acceptedDecisions,
    unresolved_issues: openIssues,
    provisional_state: admitted.provisionalState,
    governance_principles: admitted.governancePrinciples,
    invariants: admitted.invariants,
    continuity_safeguards: admitted.continuitySafeguards,
    rejected_directions: admitted.rejectedDirections,
    quarantine_log: admitted.quarantineLog,
    deferred_items: admitted.deferredItems,
    conditional_admissions: admitted.conditionalAdmissions,
    mutation_targets: admitted.mutationTargets,
    continuity_review: cleanContinuityReview(review, admitted),
    continuity_state_history: cleanContinuityStateHistory(admitted),
    workflow_evolution: admitted.workflowEvolution.map((change) => ({ change })),
    diagnostic_data: {
      ...diagnosticMetadata(result, transformedText, undefined, admitted),
      admission_filter: portableAdmissionSummary(admitted.diagnostics),
      trusted_state_summary: [
        admitted.activeObjective,
        ...admitted.stableConstraints,
        ...admitted.acceptedDecisions
      ].slice(0, MAX_PORTABLE_CONTEXT_ITEMS),
      untrusted_instruction_summary: [
        ...admitted.rejectedDirections,
        ...admitted.quarantineLog,
        ...admitted.deferredItems
      ].slice(0, MAX_PORTABLE_CONTEXT_ITEMS),
      mutation_risk_report: review.diagnostics.mutation_risk_report
    },
    risk_scores: {
      risk_score: result.scores.riskScore,
      source_purity_score: result.scores.sourcePurityScore,
      bucket_exclusivity_score: result.scores.bucketExclusivityScore,
      chrome_contamination_score: result.scores.chromeContaminationScore,
      assistant_contamination_score: result.scores.assistantContaminationScore,
      durable_precision_score: result.scores.durableStatePrecision,
      durable_recall_estimate: result.scores.durableRecallEstimate,
      export_readiness_score: result.scores.exportReadiness,
      export_readiness_decision: truth.final_artifact_readiness_decision
    },
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
      ...admitted.recommendedNextActions.map((action) => `Next action: ${action}`)
    ]).slice(0, 16),
    carryForwardContext: admitted.carryForwardContext,
    targetModel: result.targetModelApplied,
    tags: uniqueNonEmpty(["continuity-review", result.targetModelApplied])
  };
}

export function buildCapsuleDraft(
  result: TransformResult,
  transformedText: string,
  sessionState?: SessionGovernanceState | null
): CapsuleDraft {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const admitted = buildAdmittedState(result, transformedText, sessionState);
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
    objective: admitted.activeObjective,
    constraints,
    stable_constraints: constraints,
    decisions,
    accepted_decisions: decisions,
    open_questions: openQuestions,
    unresolved_issues: openQuestions,
    governance_state: {
      trusted_state_summary: [
        admitted.activeObjective,
        ...admitted.stableConstraints,
        ...admitted.acceptedDecisions
      ].slice(0, MAX_PORTABLE_CONTEXT_ITEMS),
      untrusted_instruction_summary: [
        ...admitted.rejectedDirections,
        ...admitted.quarantineLog,
        ...admitted.deferredItems
      ].slice(0, MAX_PORTABLE_CONTEXT_ITEMS),
      conflict_report: review.diagnostics.adversarialGovernance
        ? {
            has_conflict: review.diagnostics.adversarialGovernance.conflict_report.has_conflict,
            conflicts: admitted.rejectedDirections.slice(0, MAX_PORTABLE_CONTEXT_ITEMS),
            warnings: review.diagnostics.adversarialGovernance.conflict_report.warnings
          }
        : undefined,
      mutation_risk_report: review.diagnostics.mutation_risk_report
    },
    governance_principles: admitted.governancePrinciples,
    invariants: admitted.invariants,
    continuity_safeguards: admitted.continuitySafeguards,
    quarantine_log: admitted.quarantineLog,
    deferred_items: admitted.deferredItems,
    conditional_admissions: admitted.conditionalAdmissions,
    mutation_targets: admitted.mutationTargets,
    rejected_directions: admitted.rejectedDirections,
    continuity_anchors: admitted.continuityAnchors,
    reconstruction_instructions:
      "Use active_objective, stable_constraints, accepted_decisions, unresolved_issues, governance_principles, invariants, rejected_directions, quarantine_log, deferred_items, mutation_targets, and continuity_anchors to reconstruct the working context before continuing.",
    model_transfer_notes: {
      target_model: result.targetModelApplied,
      preferred_mode: result.modeApplied ?? parsed?.preferred_mode,
      source_platform: sourcePlatform(result)
    },
    diagnostic_metadata: {
      ...diagnosticMetadata(result, transformedText, undefined, admitted),
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
  const admitted = buildAdmittedState(
    context.result,
    context.transformedText,
    context.sessionState
  );
  const truth = finalTruthFromAdmitted(context.result, admitted);
  return {
    capsule_id: capsule.capsule_id ?? capsule.id,
    version: capsule.version ?? capsule.capsule_version,
    created_at: capsule.created_at,
    updated_at: capsule.updated_at ?? capsule.created_at,
    title: capsule.title,
    workflow_identity:
      capsule.workflow_identity ??
      titleFromObjective(admitted.activeObjective, "Continuity workflow"),
    source_platform: capsule.source_platform ?? sourcePlatform(context.result),
    detected_model:
      capsule.detected_model ?? context.result.targetModelApplied ?? review.diagnostics.targetModel,
    active_objective: admitted.activeObjective,
    export_source_mode: admitted.diagnostics.export_source_mode,
    final_artifact_source_mode: truth.final_artifact_source_mode,
    final_artifact_objective: truth.final_artifact_objective,
    final_artifact_durable_count: truth.final_artifact_durable_count,
    final_artifact_durable_item_count: truth.final_artifact_durable_item_count,
    final_evaluated_objective: truth.final_evaluated_objective,
    final_artifact_readiness_decision: truth.final_artifact_readiness_decision,
    final_export_readiness_decision: truth.final_export_readiness_decision,
    final_missing_state_summary: truth.final_missing_state_summary,
    final_artifact_blockers: truth.final_artifact_blockers,
    final_readiness_blockers: truth.final_readiness_blockers,
    session_durable_item_count: admitted.diagnostics.session_durable_item_count,
    latest_turn_durable_item_count: admitted.diagnostics.latest_turn_durable_item_count,
    durable_items_carried_forward_count:
      admitted.diagnostics.durable_items_carried_forward_count,
    durable_items_overridden_by_latest_turn_count:
      admitted.diagnostics.durable_items_overridden_by_latest_turn_count,
    session_items_considered_count: truth.session_items_considered_count,
    session_items_admitted_count: truth.session_items_admitted_count,
    session_items_rejected_as_shell_count: truth.session_items_rejected_as_shell_count,
    review_export_truth_match: truth.review_export_truth_match,
    fallback_to_latest_turn_only: admitted.diagnostics.fallback_to_latest_turn_only,
    session_level_capsule_passed: admitted.diagnostics.session_level_capsule_passed,
    capsule_quality_blockers: admitted.diagnostics.quality_gate_blockers,
    export_readiness_decision: truth.final_artifact_readiness_decision,
    review_readiness_decision: truth.final_artifact_readiness_decision,
    raw_review_readiness_decision: review.diagnostics.export_readiness_decision,
    source_purity_score: review.diagnostics.export_readiness_decision
      ? context.result.scores.sourcePurityScore
      : undefined,
    bucket_exclusivity_score: context.result.scores.bucketExclusivityScore,
    chrome_contamination_score: context.result.scores.chromeContaminationScore,
    assistant_contamination_score: context.result.scores.assistantContaminationScore,
    durable_precision_score: context.result.scores.durableStatePrecision,
    durable_recall_estimate: context.result.scores.durableRecallEstimate,
    export_readiness_score: context.result.scores.exportReadiness,
    stable_constraints: admitted.stableConstraints,
    accepted_decisions: admitted.acceptedDecisions,
    unresolved_issues: admitted.unresolvedIssues,
    governance_state: context.sessionState
      ? compactGovernanceSummary(context.sessionState)
      : (capsule.governance_state ?? compactGovernanceSummary(context.sessionState)),
    governance_principles: admitted.governancePrinciples,
    invariants: admitted.invariants,
    continuity_safeguards: admitted.continuitySafeguards,
    quarantine_log: admitted.quarantineLog,
    deferred_items: admitted.deferredItems,
    conditional_admissions: admitted.conditionalAdmissions,
    mutation_targets: admitted.mutationTargets,
    rejected_directions: admitted.rejectedDirections,
    continuity_anchors: admitted.continuityAnchors,
    reconstruction_instructions:
      "Reconstruct the active objective, stable constraints, accepted decisions, unresolved issues, governance principles, invariants, rejected directions, quarantined items, deferred items, mutation targets, and continuity anchors before continuing the workflow.",
    model_transfer_notes: {
      ...(capsule.model_transfer_notes ?? {}),
      source_platform: sourcePlatform(context.result),
      target_model: context.result.targetModelApplied,
      preferred_mode: capsule.preferred_mode ?? context.result.modeApplied
    },
    build_provenance:
      review.diagnostics.build_provenance ?? getBuildProvenance(context.extensionVersion),
    runtime_snapshot: review.diagnostics.runtime_snapshot,
    diagnostic_metadata: {
      ...diagnosticMetadata(
        context.result,
        context.transformedText,
        context.extensionVersion,
        admitted
      ),
      admission_filter: portableAdmissionSummary(admitted.diagnostics)
    },
    capsule_text: admitted.capsuleText
  };
}

export function buildPortableWorkflowArtifact(
  workflow: Workflow,
  context: ReviewArtifactContext
): Record<string, unknown> {
  const admitted = buildAdmittedState(
    context.result,
    context.transformedText,
    context.sessionState
  );
  const truth = finalTruthFromAdmitted(context.result, admitted);
  return {
    workflow_id: workflow.workflow_id ?? workflow.id,
    version: workflow.version ?? 1,
    created_at: workflow.createdAt,
    updated_at: workflow.updatedAt,
    title: workflow.title,
    source_platform: workflow.source_platform ?? sourcePlatform(context.result),
    detected_model:
      workflow.detected_model ?? workflow.targetModel ?? context.result.targetModelApplied,
    active_objective: admitted.activeObjective,
    export_source_mode: admitted.diagnostics.export_source_mode,
    final_artifact_source_mode: truth.final_artifact_source_mode,
    final_artifact_objective: truth.final_artifact_objective,
    final_artifact_durable_count: truth.final_artifact_durable_count,
    final_artifact_durable_item_count: truth.final_artifact_durable_item_count,
    final_evaluated_objective: truth.final_evaluated_objective,
    final_artifact_readiness_decision: truth.final_artifact_readiness_decision,
    final_missing_state_summary: truth.final_missing_state_summary,
    final_artifact_blockers: truth.final_artifact_blockers,
    final_readiness_blockers: truth.final_readiness_blockers,
    session_durable_item_count: admitted.diagnostics.session_durable_item_count,
    latest_turn_durable_item_count: admitted.diagnostics.latest_turn_durable_item_count,
    durable_items_carried_forward_count:
      admitted.diagnostics.durable_items_carried_forward_count,
    durable_items_overridden_by_latest_turn_count:
      admitted.diagnostics.durable_items_overridden_by_latest_turn_count,
    session_items_considered_count: truth.session_items_considered_count,
    session_items_admitted_count: truth.session_items_admitted_count,
    session_items_rejected_as_shell_count: truth.session_items_rejected_as_shell_count,
    review_export_truth_match: truth.review_export_truth_match,
    fallback_to_latest_turn_only: admitted.diagnostics.fallback_to_latest_turn_only,
    session_level_capsule_passed: admitted.diagnostics.session_level_capsule_passed,
    capsule_quality_blockers: admitted.diagnostics.quality_gate_blockers,
    export_readiness_decision: truth.final_artifact_readiness_decision,
    review_readiness_decision: truth.final_artifact_readiness_decision,
    raw_review_readiness_decision:
      context.result.continuityReview.diagnostics.export_readiness_decision,
    final_export_readiness_decision: truth.final_export_readiness_decision,
    source_purity_score: context.result.scores.sourcePurityScore,
    bucket_exclusivity_score: context.result.scores.bucketExclusivityScore,
    chrome_contamination_score: context.result.scores.chromeContaminationScore,
    assistant_contamination_score: context.result.scores.assistantContaminationScore,
    durable_precision_score: context.result.scores.durableStatePrecision,
    durable_recall_estimate: context.result.scores.durableRecallEstimate,
    export_readiness_score: context.result.scores.exportReadiness,
    stable_constraints: admitted.stableConstraints,
    accepted_decisions: admitted.acceptedDecisions,
    unresolved_issues: admitted.unresolvedIssues,
    provisional_state: admitted.provisionalState,
    governance_principles: admitted.governancePrinciples,
    invariants: admitted.invariants,
    continuity_safeguards: admitted.continuitySafeguards,
    rejected_directions: admitted.rejectedDirections,
    quarantine_log: admitted.quarantineLog,
    deferred_items: admitted.deferredItems,
    conditional_admissions: admitted.conditionalAdmissions,
    mutation_targets: admitted.mutationTargets,
    continuity_review: cleanContinuityReview(context.result.continuityReview, admitted),
    continuity_state_history: cleanContinuityStateHistory(admitted),
    workflow_evolution: admitted.workflowEvolution.map((change) => ({ change })),
    diagnostic_data: {
      ...diagnosticMetadata(
        context.result,
        context.transformedText,
        context.extensionVersion,
        admitted
      ),
      admission_filter: portableAdmissionSummary(admitted.diagnostics)
    },
    risk_scores: workflow.risk_scores ?? {
      risk_score: context.result.scores.riskScore,
      source_purity_score: context.result.scores.sourcePurityScore,
      bucket_exclusivity_score: context.result.scores.bucketExclusivityScore,
      chrome_contamination_score: context.result.scores.chromeContaminationScore,
      assistant_contamination_score: context.result.scores.assistantContaminationScore,
      durable_precision_score: context.result.scores.durableStatePrecision,
      durable_recall_estimate: context.result.scores.durableRecallEstimate,
      export_readiness_score: context.result.scores.exportReadiness,
      export_readiness_decision: truth.final_artifact_readiness_decision
    },
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
    build_provenance:
      context.result.continuityReview.diagnostics.build_provenance ??
      getBuildProvenance(context.extensionVersion),
    runtime_snapshot: context.result.continuityReview.diagnostics.runtime_snapshot,
    carry_forward_context: admitted.carryForwardContext
  };
}

export function buildDiagnosticState(context: ReviewArtifactContext): Record<string, unknown> {
  const review = context.result.continuityReview;
  const admitted = buildAdmittedState(
    context.result,
    context.transformedText,
    context.sessionState
  );
  const truth = finalTruthFromAdmitted(context.result, admitted);
  return {
    diagnostic_id: `diagnostic-${Date.now()}`,
    version: 1,
    timestamp: new Date().toISOString(),
    capture_verification: {
      conversation_id: context.conversationId ?? null,
      conversation_key: context.conversationKey ?? context.sessionState?.conversationKey ?? null,
      conversation_key_is_ephemeral:
        context.conversationKeyIsEphemeral ??
        (typeof (context.conversationKey ?? context.sessionState?.conversationKey) === "string"
          ? /:tab-[a-z0-9-]+$/i.test(
              (context.conversationKey ?? context.sessionState?.conversationKey) as string
            )
          : null),
      snapshot_scope: context.snapshotScope ?? context.sessionState?.diagnostics?.snapshot_scope ?? null
    },
    governance_routing: {
      awg_distribution: context.sessionState?.diagnostics?.awg_distribution ?? null,
      legality: context.sessionState?.diagnostics?.legality ?? null
    },
    build_provenance:
      review.diagnostics.build_provenance ?? getBuildProvenance(context.extensionVersion),
    clean_summary: review.cleanSummary,
    active_objective: admitted.activeObjective,
    export_source_mode: admitted.diagnostics.export_source_mode,
    final_artifact_source_mode: truth.final_artifact_source_mode,
    final_artifact_objective: truth.final_artifact_objective,
    final_artifact_durable_count: truth.final_artifact_durable_count,
    final_artifact_durable_item_count: truth.final_artifact_durable_item_count,
    final_evaluated_objective: truth.final_evaluated_objective,
    final_artifact_readiness_decision: truth.final_artifact_readiness_decision,
    final_export_readiness_decision: truth.final_export_readiness_decision,
    final_missing_state_summary: truth.final_missing_state_summary,
    final_artifact_blockers: truth.final_artifact_blockers,
    final_readiness_blockers: truth.final_readiness_blockers,
    session_durable_item_count: admitted.diagnostics.session_durable_item_count,
    latest_turn_durable_item_count: admitted.diagnostics.latest_turn_durable_item_count,
    durable_items_carried_forward_count:
      admitted.diagnostics.durable_items_carried_forward_count,
    durable_items_overridden_by_latest_turn_count:
      admitted.diagnostics.durable_items_overridden_by_latest_turn_count,
    session_items_considered_count: truth.session_items_considered_count,
    session_items_admitted_count: truth.session_items_admitted_count,
    session_items_rejected_as_shell_count: truth.session_items_rejected_as_shell_count,
    review_export_truth_match: truth.review_export_truth_match,
    fallback_to_latest_turn_only: admitted.diagnostics.fallback_to_latest_turn_only,
    session_level_capsule_passed: admitted.diagnostics.session_level_capsule_passed,
    capsule_quality_blockers: admitted.diagnostics.quality_gate_blockers,
    stable_core: uniqueNonEmpty([...admitted.stableConstraints, ...admitted.acceptedDecisions]),
    provisional_state: admitted.provisionalState,
    open_unresolved: admitted.unresolvedIssues,
    rejected_directions: admitted.rejectedDirections,
    governance_principles: admitted.governancePrinciples,
    invariants: admitted.invariants,
    continuity_safeguards: admitted.continuitySafeguards,
    quarantine_log: admitted.quarantineLog,
    deferred_items: admitted.deferredItems,
    conditional_admissions: admitted.conditionalAdmissions,
    mutation_targets: admitted.mutationTargets,
    mutation_risk_report: review.diagnostics.mutation_risk_report,
    trusted_state_summary: review.diagnostics.trusted_state_summary,
    untrusted_instruction_summary: review.diagnostics.untrusted_instruction_summary,
    continuity_anchors: admitted.continuityAnchors,
    portable_capsule_snapshot: context.capsule
      ? buildPortableCapsuleArtifact(context.capsule, context)
      : null,
    portable_workflow_snapshot: context.workflow
      ? buildPortableWorkflowArtifact(context.workflow, context)
      : null,
    raw_capsule: context.capsule ?? review.diagnostics.rawCapsule ?? null,
    raw_workflow_state: context.workflow ?? null,
    compression_score: context.result.scores.compactnessScore,
    constraint_score: context.result.scores.constraintPreservationScore,
    risk_score: context.result.scores.riskScore,
    source_purity_score: context.result.scores.sourcePurityScore,
    bucket_exclusivity_score: context.result.scores.bucketExclusivityScore,
    chrome_contamination_score: context.result.scores.chromeContaminationScore,
    assistant_contamination_score: context.result.scores.assistantContaminationScore,
    durable_precision_score: context.result.scores.durableStatePrecision,
    durable_recall_estimate: context.result.scores.durableRecallEstimate,
    export_readiness_score: context.result.scores.exportReadiness,
    export_readiness_decision: truth.final_artifact_readiness_decision,
    review_readiness_decision: truth.final_artifact_readiness_decision,
    raw_review_readiness_decision: review.diagnostics.export_readiness_decision,
    review_truthfulness_score: context.result.scores.reviewTruthfulness,
    continuity_metrics: context.sessionState?.monitors ?? {
      compactness_score: context.result.scores.compactnessScore,
      constraint_preservation_score: context.result.scores.constraintPreservationScore,
      risk_score: context.result.scores.riskScore
    },
    platform: sourcePlatform(context.result),
    detected_model: context.result.targetModelApplied ?? review.diagnostics.targetModel,
    current_url_or_domain: context.currentUrl,
    extension_version: context.extensionVersion,
    build_timestamp:
      (review.diagnostics.build_provenance ?? getBuildProvenance(context.extensionVersion))
        .build_timestamp,
    commit_sha:
      (review.diagnostics.build_provenance ?? getBuildProvenance(context.extensionVersion))
        .commit_sha,
    environment_tag:
      (review.diagnostics.build_provenance ?? getBuildProvenance(context.extensionVersion))
        .environment_tag,
    active_constraints: context.result.extractedConstraints,
    provider_profile: review.diagnostics.providerProfile,
    provider_health: review.diagnostics.providerHealth,
    runtime_snapshot: review.diagnostics.runtime_snapshot,
    retrieval_context: review.diagnostics.retrievalContext,
    adversarial_governance: review.diagnostics.adversarialGovernance,
    metric_warnings: review.diagnostics.metric_warnings,
    admission_filter: admitted.diagnostics,
    warnings: uniqueNonEmpty([
      ...(context.sessionState?.diagnostics.warnings ?? []),
      ...admitted.diagnostics.warnings,
      ...(review.diagnostics.metric_warnings ?? [])
    ]),
    diagnostic_logs: review.diagnostics.pipelineSteps,
    raw_review_state: {
      active_objective: review.activeObjective,
      stable_core: review.stableCore,
      provisional_state: review.newProvisional,
      open_unresolved: review.openUnresolved,
      rejected_directions: review.diagnostics.rejected_items,
      task_local_instructions: review.diagnostics.task_local_instructions,
      task_local_forbidden: review.diagnostics.task_local_forbidden,
      governance_principles: review.diagnostics.governance_principles,
      invariants: review.diagnostics.invariants,
      continuity_safeguards: review.diagnostics.continuity_safeguards,
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
    ...bulletSection(
      "## Provisional State",
      diagnostic.provisional_state as string[],
      "No provisional items."
    ),
    "",
    ...bulletSection(
      "## Open / Unresolved",
      diagnostic.open_unresolved as string[],
      "No open items."
    ),
    "",
    ...bulletSection(
      "## Rejected Directions",
      diagnostic.rejected_directions as string[],
      "No rejected directions admitted."
    ),
    "",
    ...bulletSection(
      "## Governance Principles",
      diagnostic.governance_principles as string[],
      "No governance principles admitted."
    ),
    "",
    ...bulletSection("## Invariants", diagnostic.invariants as string[], "No invariants admitted."),
    "",
    ...bulletSection(
      "## Quarantine / Deferred",
      [
        ...((diagnostic.quarantine_log as string[]) ?? []),
        ...((diagnostic.deferred_items as string[]) ?? [])
      ],
      "No quarantined or deferred items."
    ),
    "",
    ...bulletSection("## Warnings", diagnostic.warnings as string[], "No diagnostic warnings."),
    "",
    "## Scores",
    `- Compression: ${diagnostic.compression_score}`,
    `- Constraint: ${diagnostic.constraint_score}`,
    `- Risk: ${diagnostic.risk_score}`,
    `- Source purity: ${diagnostic.source_purity_score}`,
    `- Bucket exclusivity: ${diagnostic.bucket_exclusivity_score}`,
    `- Chrome contamination: ${diagnostic.chrome_contamination_score}`,
    `- Assistant contamination: ${diagnostic.assistant_contamination_score}`,
    `- Durable precision: ${diagnostic.durable_precision_score}`,
    `- Durable recall estimate: ${diagnostic.durable_recall_estimate}`,
    `- Export readiness: ${diagnostic.export_readiness_score}`,
    `- Export decision: ${diagnostic.export_readiness_decision}`,
    `- Review truthfulness: ${diagnostic.review_truthfulness_score}`,
    "",
    "## Raw JSON",
    "```json",
    JSON.stringify(diagnostic, null, 2),
    "```"
  ];
  return lines.join("\n");
}

export function artifactFilename(
  kind: "capsule" | "workflow" | "diagnostic",
  title: string,
  timestamp = new Date()
): string {
  const safeTitle = cleanLine(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `luxcrypta-${kind}-${safeTitle || "artifact"}-${timestamp.toISOString().slice(0, 10)}.json`;
}
