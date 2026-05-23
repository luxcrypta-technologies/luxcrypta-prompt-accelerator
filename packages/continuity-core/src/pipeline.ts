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
  "mission|objective|trusted state|trusted_state|stable state|stable core|stable constraints|stable constraint|stable requirements that cannot change without breaking the mission|stable requirements|stable requirement|accepted decisions|accepted decision|new\\s*\\/\\s*provisional|open\\s*\\/\\s*unresolved|open questions|open question|open tensions|open tension|unresolved tensions|unresolved tension|requirements that remain in real tension|missing information|what changed|recommended next actions|continuity instructions|untrusted instructions|untrusted_instructions|quarantine log|quarantine_log|deferred items|deferred item|deferred_items|conditional admissions|conditional admission|conditional_admissions|rejected directions|rejected direction|rejected_directions|governance principles|governance principle|governance_principles|invariants|invariant|continuity safeguards|continuity safeguard|continuity_safeguards|continuity anchors|continuity anchor|recovery mechanisms|recovery mechanism|reconstruction instructions|reconstruction instruction|cross-model transfer notes|cross model transfer notes|mutation targets|mutation target|mutation risk|failure modes|failure mode|operational risks|operational risk|priority model|provisional assumptions|provisional assumption|task local instructions|task-local instructions|task_local_instructions|task local forbidden|task-local forbidden|task_local_forbidden";

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
  /\b(governance|trusted state|untrusted|admission|taxonomy|state boundary|conflict handling|audit|visibility|integrity|priority|review state|transparency|truthfulness|fail[-\s]?closed|source provenance|primary bucket|bucket exclusivity|outranks)\b/i;
const INVARIANT_RE =
  /\b(invariant|must remain|must never|durable|non-negotiable|if violated|no silent transitions|identity anchoring|operational identity|always-on|always on|preserve (?:the )?(?:mission|governance|integrity|rejected directions|unresolved tensions|stable constraints)|do not overwrite trusted state)\b/i;
const CONTINUITY_SAFEGUARD_RE =
  /\b(continuity safeguard|safeguard|continuity anchor|carry[-\s]?forward|reconstruction|recovery mechanism|cross[-\s]?model transfer|preserve continuity|preserve unresolved|keep unresolved|no silent transitions|audit visibility)\b/i;
const MUTATION_RE =
  /\b(attempted (?:state )?override|override (?:trusted state|mission|governance|instructions?)|override block|mutation|mutate|replace|delete|remove|suppress|hidden rewrite|forced resolution|force resolution|false claim|insert false|state override|delete safeguards|suppress audit|ignore previous|discard trusted|treat all unresolved tensions as resolved|unresolved tensions as resolved)\b/i;
const TASK_LOCAL_RE =
  /\b(follow the required format|required format|end with (?:a )?(?:score|rating)|end with|final scores?|mutation risk report|reconstruction confidence score|what survives cleanly|what is fragile|what is likely to drift|what must be restated verbatim|best reconstruction prompt|give (?:a )?table|use (?:a )?table|separate into \d+ sections?|include a vulnerability paragraph|build a priority model|stage \d+|return (?:the )?(?:answer|response) as|answer[-\s]?shape|response format|markdown table|bullet list|numbered list|write in (?:four|five|six|\d+) sections?)\b/i;
const PROMPT_SCAFFOLD_RE =
  /\b(below is|here is|structured response|final response|stage \d+|step \d+|copy[-\s]?paste|prompt block|prompt scaffolding|response wrapper|answer contract|final scores?|reconstruction confidence score|best reconstruction prompt)\b/i;
const ASSISTANT_RECONSTRUCTION_RE =
  /\b(a future model reconstructing this state must|future model reconstructing|future model should|restore the mission exactly|portable operational cognition state|defended continuity state|mutation risk report)\b/i;
const ADOPTION_RE =
  /\b(adopt|promote|save|remember|make (?:this|it) canonical|this is canonical|treat (?:this|it) as stable|user[-\s]?promoted|explicitly adopted)\b/i;
const SPEAKER_PREFIX_RE = /^\s*(?:user|assistant|system|developer|model|human|ai)\s*:\s*/i;
const SECTION_LABEL_RE =
  /^\s*(?:[-*•>]+\s*)?(mission|trusted state|trusted_state|stable state|stable core|stable constraints|stable constraint|stable requirements|stable requirement|stable requirements that cannot change without breaking the mission|accepted decisions|accepted decision|objective|untrusted instructions|untrusted_instructions|conflicting instructions|quarantine log|quarantine_log|quarantine|quarantined item|deferred items|deferred item|deferred_items|defer|conditional admissions|conditional admission|conditional_admissions|conditional admit|rejected directions|rejected direction|rejected_directions|rejections|governance principles|governance principle|governance_principles|invariants|invariant|continuity safeguards|continuity safeguard|continuity_safeguards|continuity anchors|continuity anchor|recovery mechanisms|recovery mechanism|reconstruction instructions|reconstruction instruction|cross-model transfer notes|cross model transfer notes|mutation targets|mutation target|mutation risk|failure modes|failure mode|operational risks|operational risk|open unresolved|open\s*\/\s*unresolved|open questions|open question|open tensions|open tension|unresolved tensions|unresolved tension|requirements that remain in real tension|missing information|new provisional|new\s*\/\s*provisional|provisional assumptions|provisional assumption|admitted updates|priority model|task local instructions|task-local instructions|task_local_instructions|task local forbidden|task-local forbidden|task_local_forbidden)(?::\s*(.*)|\s*)$/i;

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

function providerLabel(request: TransformRequest): string {
  return providerId(request) || "unknown";
}

function isTrustedPriorRole(sourceRole: ContinuitySourceRole): boolean {
  return (
    sourceRole === "trusted_state" ||
    sourceRole === "user_quoted_prior_state" ||
    sourceRole === "prior_review_state"
  );
}

function isUserAuthoredRole(sourceRole: ContinuitySourceRole): boolean {
  return (
    sourceRole === "trusted_user_input" ||
    sourceRole === "user_authored_input" ||
    sourceRole === "user_authored" ||
    isTrustedPriorRole(sourceRole)
  );
}

function isAssistantRole(sourceRole: ContinuitySourceRole): boolean {
  return sourceRole === "assistant_output" || sourceRole === "assistant_generated";
}

function isExternalModelRole(sourceRole: ContinuitySourceRole): boolean {
  return sourceRole === "external_model_output" || isAssistantRole(sourceRole);
}

function isRetrievedRole(sourceRole: ContinuitySourceRole): boolean {
  return (
    sourceRole === "retrieval_content" ||
    sourceRole === "retrieved_external_content" ||
    sourceRole === "retrieved_external"
  );
}

function isChromeRole(sourceRole: ContinuitySourceRole): boolean {
  return (
    sourceRole === "provider_ui" ||
    sourceRole === "provider_ui_chrome" ||
    sourceRole === "extension_ui_chrome" ||
    sourceRole === "page_chrome" ||
    sourceRole === "system_ui" ||
    sourceRole === "extension_ui"
  );
}

function isPerplexityUiArtifact(text: string): boolean {
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    /^(showmore|showless|showmoreshowless|copied|copy|copyallreview|copyreviewrawjson|copyengineeringsummary|copyportablecapsule|copyworkflowexport|copylink|share|rewrite|sources|related|askfollowup|thread|library|discover|home|settings|signindashboard|upgrade|advanced|retryopen|viewmore|viewless|trypro|perplexity)$/.test(
      clean
    ) ||
    /^(show more|show less|related questions|ask follow-up|view sources|copy link|copy all review|copy review \+ raw json|copy engineering summary|copy portable capsule|copy workflow export|share thread|rewrite answer|search images|search videos|spaces|library|discover|advanced|retry open|sign in|try pro|upgrade)$/i.test(
      text.trim()
    )
  );
}

function isGenericUiChromeArtifact(text: string): boolean {
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return (
    isPerplexityUiArtifact(text) ||
    /^(apply|cancel|close|download|downloadjson|export|exportdiagnosticstate|copyrawdiagnosticdata|copyjson|copyraw|promptreview|save|saveworkflow|savecapsule|toolbar|menu|settings|newchat|search|library|login|logout|upgrade|subscribe|poweredbyluxcrypta|readytoreview|openingreview|reviewopened|reviewdidnotopenretryopen)$/.test(
      clean
    )
  );
}

function stripPerplexityUIArtifacts(text: string): string {
  return text
    .replace(/show more\s*show less/gi, "\n")
    .replace(/\b(Copy|Copy JSON|Copy Raw|Copy All Review|Copy Review \+ Raw JSON|Copy Engineering Summary|Copy Portable Capsule|Copy Workflow Export|Copy Raw Diagnostic Data|Prompt Review|Export Diagnostic State|Advanced|Retry Open)\b/gi, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || isGenericUiChromeArtifact(line)) return false;
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

function stripProviderGeneratedWrappers(text: string, provider: string): string {
  const wrapperPatterns: RegExp[] = [
    /^\s*(?:here(?:'s| is)|below is|i can help|certainly|sure)\b.*$/i,
    /^\s*(?:structured response|final answer|final response|prompt review|review output)\s*:?\s*$/i,
    /^\s*(?:copy|copied|copy link|share|advanced|show more|show less)\s*$/i
  ];
  const providerPatterns: Record<string, RegExp[]> = {
    deepseek: [
      /^\s*(?:stage|phase|step)\s+\d+\s*:.*$/i,
      /^\s*(?:analysis|reasoning|final)\s*:?\s*$/i
    ],
    chatgpt: [
      /^\s*(?:here is a cleaned|here's a cleaned|i've structured|summary)\b.*$/i,
      /^\s*(?:recommended structure|suggested format)\s*:?\s*$/i
    ],
    claude: [],
    gemini: [
      /^\s*(?:compliance statement|enforcement framework|formal validation|architectural compliance)\s*:?\s*$/i,
      /^\s*(?:therefore|in conclusion),?\s*(?:the following|we must)\b.*$/i
    ],
    perplexity: [
      /^\s*(?:sources?|related|ask follow-up|search results?)\s*:?\s*$/i,
      /^\s*(?:try pro|upgrade|discover|library|spaces)\b.*$/i
    ]
  };
  const patterns = [...wrapperPatterns, ...(providerPatterns[provider] ?? [])];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      const semanticLine = line.replace(SPEAKER_PREFIX_RE, "").trim();
      return (
        line &&
        !isGenericUiChromeArtifact(line) &&
        !patterns.some((pattern) => pattern.test(line) || pattern.test(semanticLine))
      );
    })
    .join("\n")
    .trim();
}

interface PreparedProviderSource {
  text: string;
  extractionDegraded: boolean;
  contaminationMarkers: string[];
}

function lineUiRatio(text: string): number {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return 1;
  return lines.filter(isGenericUiChromeArtifact).length / lines.length;
}

function extractionMarkers(rawText: string, preparedText: string): string[] {
  const markers = [
    /\b(show more|show less|copy json|copy raw|prompt review|advanced|retry open|try pro|upgrade)\b/i.test(
      rawText
    )
      ? "provider_or_extension_chrome_seen"
      : "",
    lineUiRatio(rawText) > 0.35 ? "raw_ui_heavy_capture" : "",
    lineUiRatio(preparedText) > 0.35 ? "ui_heavy_capture" : "",
    preparedText.trim().length < 12 ? "body_too_short" : "",
    /\b(stage \d+|final scores?|reconstruction confidence|best reconstruction prompt)\b/i.test(
      preparedText
    )
      ? "scaffold_dominant_capture"
      : "",
    /(^|\n)\s*(assistant|model|ai)\s*:/i.test(preparedText)
      ? "assistant_role_text_seen"
      : ""
  ].filter(Boolean);
  return uniqueMeaningfulStrings(markers);
}

function prepareProviderSource(text: string, request: TransformRequest): PreparedProviderSource {
  const id = providerId(request);
  let prepared = text;
  if (id === "deepseek") {
    prepared = normalizeDeepSeekGovernanceBlocks(prepared);
  }
  if (id === "perplexity") {
    prepared = structuredBodyFromPerplexitySurface(prepared);
  }
  prepared = stripProviderGeneratedWrappers(prepared, id);
  prepared = normalizeRuntimeScaffold(prepared);
  const markers = extractionMarkers(text, prepared);
  return {
    text: prepared,
    extractionDegraded:
      markers.includes("ui_heavy_capture") ||
      markers.includes("body_too_short") ||
      markers.includes("scaffold_dominant_capture"),
    contaminationMarkers: markers
  };
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
  return scrubProviderChromeTokens(cleanStateLine(text))
    .replace(SPEAKER_PREFIX_RE, "")
    .replace(/^\s*(?:[-*•>]+\s*)+/, "")
    .replace(/^\s*(?:[IVXLCDM]+\.|\d+[.)]|[A-Z]\d+|[A-Z]\.)\s*/i, "")
    .replace(
      /^\s*(?:mission|trusted state|trusted_state|stable state|stable core|stable constraints|stable constraint|stable requirements|stable requirement|stable requirements that cannot change without breaking the mission|accepted decisions|accepted decision|untrusted instructions|untrusted_instructions|conflicting instructions|quarantine log|quarantine_log|quarantine|quarantined item|deferred items|deferred item|deferred_items|defer|conditional admissions|conditional admission|conditional_admissions|conditional admit|rejected directions|rejected direction|rejected_directions|rejections|governance principles|governance principle|governance_principles|invariants|invariant|continuity safeguards|continuity safeguard|continuity_safeguards|continuity anchors|continuity anchor|recovery mechanisms|recovery mechanism|reconstruction instructions|reconstruction instruction|cross-model transfer notes|cross model transfer notes|mutation targets|mutation target|mutation risk|failure modes|failure mode|operational risks|operational risk|task local instructions|task-local instructions|task_local_instructions|task local forbidden|task-local forbidden|task_local_forbidden|open unresolved|open\s*\/\s*unresolved|open tensions|open tension|unresolved tensions|unresolved tension|requirements that remain in real tension|missing information|new provisional|new\s*\/\s*provisional|provisional assumptions|provisional assumption|admitted updates|priority model|requirement|constraint|decision|risk|note|objective|open question):\s*/i,
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
  if (/stable constraints|stable requirements/.test(normalized)) return "invariants";
  if (/accepted decisions?/.test(normalized)) return "stable_core";
  if (/mission|trusted state|stable state|stable core|objective/.test(normalized)) return "stable_core";
  if (/untrusted|conflicting/.test(normalized)) return "quarantine_log";
  if (/quarantine/.test(normalized)) return "quarantine_log";
  if (/defer|deferred/.test(normalized)) return "deferred_items";
  if (/conditional/.test(normalized)) return "conditional_admissions";
  if (/reject|rejection/.test(normalized)) return "rejected_directions";
  if (/governance/.test(normalized)) return "governance_principles";
  if (/invariant/.test(normalized)) return "invariants";
  if (/safeguard|continuity anchor|recovery mechanism|reconstruction instruction|cross model transfer note/.test(normalized)) return "continuity_safeguards";
  if (/mutation/.test(normalized)) return "mutation_targets";
  if (/task local forbidden/.test(normalized)) return "task_local_forbidden";
  if (/task local instructions/.test(normalized)) return "task_local_instructions";
  if (/failure mode|operational risk|open|unresolved tension|real tension|missing information/.test(normalized)) return "open_unresolved";
  if (/priority model/.test(normalized)) return "governance_principles";
  if (/provisional assumptions?/.test(normalized)) return "provisional_state";
  if (/provisional|new/.test(normalized)) return "provisional_state";
  if (/admitted/.test(normalized)) return "provisional_state";
  return null;
}

function looksLikeReviewOrExportArtifact(text: string): boolean {
  return (
    /\bContinuity Review\b/i.test(text) &&
    /\b(Active Objective|Stable Core|Raw JSON|Transformed Continuity Draft)\b/i.test(text)
  ) || /\b(raw diagnostic data|export diagnostic state|portable capsule artifact|workflow export)\b/i.test(text);
}

function sourceRoleForStatement(rawText: string, source: string): ContinuitySourceRole {
  const lowerSource = source.toLowerCase();
  const raw = rawText.trim();
  if (/\b(source role|provenance)\s*:\s*unknown\b/i.test(raw) || /^unknown provenance\b/i.test(raw)) {
    return "unknown";
  }
  if (lowerSource.includes("export") || /^\s*(exported artifact|review export|raw json)\b/i.test(raw)) {
    return "export_artifact";
  }
  if (lowerSource.includes("diagnostic")) return "diagnostic_generated";
  if (lowerSource.includes("retrieval")) return "retrieval_content";
  if (lowerSource.includes("trusted_state")) return "trusted_state";
  if (lowerSource.includes("capsule")) return "user_quoted_prior_state";
  if (isGenericUiChromeArtifact(raw)) return "provider_ui";
  if (/^\s*(assistant|model|ai)\s*:/i.test(raw)) return "assistant_output";
  if (/^\s*(system|developer)\s*:/i.test(raw)) return "extension_ui_chrome";
  if (
    /\b(?:assistant|model|gemini|claude|chatgpt|grok|deepseek|perplexity)\s+(?:said|responded|wrote|answered)\b/i.test(
      raw
    )
  ) {
    return "external_model_output";
  }
  if (/^\s*user\s*:/i.test(raw)) return "trusted_user_input";
  if (lowerSource.includes("continuity_review")) return "prior_review_state";
  if (looksLikeReviewOrExportArtifact(raw)) return "export_artifact";
  if (lowerSource === "draft" || lowerSource === "manual") return "trusted_user_input";
  return "unknown";
}

function isPromotedByUser(text: string, sourceRole: ContinuitySourceRole): boolean {
  if (isTrustedPriorRole(sourceRole)) return true;
  if (
    isExternalModelRole(sourceRole) ||
    isRetrievedRole(sourceRole) ||
    isChromeRole(sourceRole) ||
    sourceRole === "export_artifact" ||
    sourceRole === "exported_artifact_text" ||
    sourceRole === "diagnostic_generated" ||
    sourceRole === "transformed_review_output" ||
    sourceRole === "unknown"
  ) {
    return false;
  }
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
    /^(mission|invariants|failure modes|tensions and tradeoffs|governance principles|stable core|stable constraints|stable requirements|rejected directions|open tensions|unresolved tensions|recovery mechanisms|reconstruction instructions|priority model)$/i.test(
      text.trim()
    )
  );
}

function hasGovernanceSourceSignal(text: string): boolean {
  return /\bgovernance principles?\s*:|\bgovernance principle\b|\b(?:governance|transparency|truthfulness)\b.*\boutranks\b|\btrusted state\b.*\b(untrusted|outranks|admission|boundary|priority)\b|\buntrusted\b.*\btrusted state\b|\badmission\b.*\bstate\b/i.test(
    text
  );
}

function hasInvariantSourceSignal(text: string): boolean {
  return /\b(?:stable constraints?|stable requirements?|invariants?)\s*:|\binvariant\b|\bmust remain\b|\bnon-negotiable\b|\bno silent transitions\b|\balways(?:-| )on\b|\bdurable\b.*\bmust\b|\bpreserve (?:the )?(?:mission|governance|integrity|rejected directions|unresolved tensions)\b/i.test(
    text
  );
}

function hasRejectedSourceSignal(text: string): boolean {
  return /\brejected directions?\s*:|\brejections?\s*:|\b(?:do not|don't|never|must not|should not|forbidden|prohibited)\b/i.test(
    text
  );
}

function hasContinuitySafeguardSourceSignal(text: string): boolean {
  return /\bcontinuity safeguards?\s*:|\bsafeguards?\s*:|\bcarry[-\s]?forward\b|\breconstruct(?:ion)?\b|\bpreserve unresolved\b|\bkeep unresolved\b/i.test(
    text
  );
}

function hasOpenStateSourceSignal(text: string): boolean {
  return splitGovernanceStatements(text, "draft").some((statement) => {
    if (!isEligibleUserStatement(statement)) return false;
    const clean = normalizeCanonicalText(statement.text);
    if (!clean) return false;
    if (/^(open questions?|open tensions?|unresolved tensions?|operational risks?|missing information)$/i.test(clean)) {
      return false;
    }
    if (/^(preserve|do not resolve|keep|carry forward)\s+unresolved tensions?\.?$/i.test(clean)) {
      return false;
    }
    const classification = bucketForGovernanceStatement(
      statement.text,
      statement.sectionBucket,
      statement.sourceRole
    );
    if (
      classification.bucket === "quarantine_log" ||
      classification.bucket === "rejected_directions" ||
      classification.bucket === "diagnostic_only"
    ) {
      return false;
    }
    return (
      classification.bucket === "open_unresolved" ||
      /\?|open question|unclear|unknown|risk|unresolved|needs confirmation|tension/i.test(clean)
    );
  });
}

interface GovernanceStatement {
  text: string;
  source: string;
  sourceRole: ContinuitySourceRole;
  sectionBucket?: ContinuityPrimaryBucket;
}

function splitGovernanceStatements(
  text: string,
  source: string
): GovernanceStatement[] {
  if (!text.trim()) return [];
  const prepared = normalizeRuntimeScaffold(text)
    .replace(/\r/g, "\n")
    .replace(/\s+([-*•]\s+)/g, "\n$1")
    .replace(/\s+((?:[IVXLCDM]+|\d+)\.\s+[A-Z])/g, "\n$1")
    .replace(/\s+([A-Z]\d+\s+[A-Z])/g, "\n$1");
  const output: GovernanceStatement[] = [];
  let currentBucket: ContinuityPrimaryBucket | undefined;
  let currentSourceRole: ContinuitySourceRole | undefined;
  const defaultSourceRole: ContinuitySourceRole | undefined =
    source === "draft" && looksLikeReviewOrExportArtifact(prepared) ? "export_artifact" : undefined;

  for (const rawLine of prepared.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const explicitSourceRole = sourceRoleForStatement(rawLine, source);
    if (/\b(source role|provenance)\s*:\s*unknown\b/i.test(line) || /^unknown provenance\b/i.test(line)) {
      currentSourceRole = "unknown";
      currentBucket = undefined;
      continue;
    }
    if (/^\s*(?:user|assistant|system|developer|model|human|ai)\s*:\s*$/i.test(line)) {
      currentSourceRole = explicitSourceRole;
      currentBucket = undefined;
      continue;
    }
    if (SPEAKER_PREFIX_RE.test(line)) {
      currentSourceRole = explicitSourceRole;
      currentBucket = undefined;
    }
    const statementSourceRole =
      currentSourceRole ??
      (defaultSourceRole && explicitSourceRole === "trusted_user_input"
        ? defaultSourceRole
        : explicitSourceRole);
    const lineWithoutSpeaker = line.replace(SPEAKER_PREFIX_RE, "").trim();
    if (isRetrievalContextLine(lineWithoutSpeaker)) {
      currentBucket = "quarantine_log";
      const retrievalText = retrievalTextFromLine(lineWithoutSpeaker);
      if (retrievalText) {
        output.push({
          text: `Retrieved evidence: ${retrievalText}`,
          source,
          sourceRole: "retrieved_external_content",
          sectionBucket: "quarantine_log"
        });
      }
      continue;
    }
    const labelMatch = lineWithoutSpeaker.match(SECTION_LABEL_RE);
    if (labelMatch) {
      const bucket = sectionBucket(labelMatch[1] ?? "");
      if (bucket) currentBucket = bucket;
      const remainder = normalizeCanonicalText(labelMatch[2] ?? "");
      if (!remainder) continue;
      output.push({
        text: remainder,
        source,
        sourceRole: statementSourceRole,
        sectionBucket: bucket ?? currentBucket
      });
      continue;
    }

    const pieces =
      lineWithoutSpeaker.length > 260
        ? lineWithoutSpeaker
            .split(/(?<=[.!?])\s+(?=[A-Z])/)
            .map(normalizeCanonicalText)
            .filter(Boolean)
        : [normalizeCanonicalText(lineWithoutSpeaker)].filter(Boolean);
    output.push(
      ...pieces.map((item) => ({
        text: item,
        source,
        sourceRole: statementSourceRole,
        sectionBucket: currentBucket
      }))
    );
  }

  return output.filter((item) => item.text.length > 3);
}

function uniqueCanonicalItems(items: string[]): string[] {
  return uniqueMeaningfulStrings(items.map(normalizeCanonicalText).filter(Boolean));
}

function isEligibleUserStatement(statement: GovernanceStatement): boolean {
  return (
    isUserAuthoredRole(statement.sourceRole) &&
    !isGenericUiChromeArtifact(statement.text) &&
    !isPromptScaffold(statement.text) &&
    !isTaskLocalInstruction(statement.text)
  );
}

function statementTexts(statements: GovernanceStatement[]): string[] {
  return uniqueMeaningfulStrings(statements.map((statement) => statement.text).filter(Boolean));
}

function statementTextIsCovered(statements: GovernanceStatement[], candidate: string): boolean {
  return statements.some((statement) =>
    isMeaningfullyDuplicate(statement.text, candidate, 0.72)
  );
}

function isReservedGovernanceBucket(bucket: ContinuityPrimaryBucket | undefined): boolean {
  return Boolean(
    bucket &&
      [
        "governance_principles",
        "invariants",
        "continuity_safeguards",
        "rejected_directions",
        "quarantine_log",
        "deferred_items",
        "open_unresolved",
        "task_local_forbidden",
        "task_local_instructions",
        "mutation_targets"
      ].includes(bucket)
  );
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
  if (isChromeRole(sourceRole)) {
    return {
      bucket: "diagnostic_only",
      decision: "quarantine",
      reason: "UI or system chrome is not continuity state"
    };
  }
  if (
    (isExternalModelRole(sourceRole) || isRetrievedRole(sourceRole)) &&
    !isPromotedByUser(text, sourceRole)
  ) {
    return {
      bucket: "quarantine_log",
      decision: "quarantine",
      reason: `${sourceRole.replace(/_/g, " ")} requires explicit user promotion before admission`
    };
  }
  if (
    (sourceRole === "diagnostic_generated" ||
      sourceRole === "transformed_review_output" ||
      sourceRole === "export_artifact" ||
      sourceRole === "exported_artifact_text") &&
    !isPromotedByUser(text, sourceRole)
  ) {
    return {
      bucket: "diagnostic_only",
      decision: "quarantine",
      reason: `${sourceRole.replace(/_/g, " ")} cannot be re-admitted as source truth`
    };
  }
  if (!isUserAuthoredRole(sourceRole) && sourceRole !== "unknown") {
    return {
      bucket: "quarantine_log",
      decision: "quarantine",
      reason: `${sourceRole.replace(/_/g, " ")} is not eligible for direct durable admission`
    };
  }
  if (sourceRole === "unknown") {
    return {
      bucket: "diagnostic_only",
      decision: "quarantine",
      reason: "unknown source role fails closed"
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
      bucket: "diagnostic_only",
      decision: "defer",
      reason: "task-local answer instruction, not durable state"
    };
  }
  if (section === "task_local_forbidden") {
    return {
      bucket: "diagnostic_only",
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
      bucket: "deferred_items",
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
      bucket: "diagnostic_only",
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
      bucket: "quarantine_log",
      decision: "quarantine",
      reason: "mutation risk preserved for analysis"
    };
  }
  if (section === "open_unresolved") {
    return { bucket: "open_unresolved", decision: "defer", reason: "open or unresolved state" };
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
      bucket: "deferred_items",
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
  if (/\?|open question|unresolved|unclear|risk|tension|unknown/i.test(text)) {
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
  provider: string,
  crossRefs: ContinuityPrimaryBucket[] = []
): CanonicalContinuityItem {
  const admitted = decision === "admit" || decision === "conditional_admit";
  return {
    id: canonicalId(text, bucket),
    text: normalizeCanonicalText(text),
    primary_bucket: bucket,
    decision,
    source,
    source_role: sourceRole,
    provider,
    extraction_path: source,
    admission_reason: admitted ? reason : undefined,
    blocked_reason: admitted ? undefined : reason,
    reason,
    cross_refs: crossRefs.length ? crossRefs : undefined
  };
}

const BUCKET_PRIORITY: Record<ContinuityPrimaryBucket, number> = {
  invariants: 100,
  governance_principles: 94,
  rejected_directions: 88,
  stable_core: 78,
  open_unresolved: 68,
  continuity_safeguards: 64,
  provisional_state: 54,
  quarantine_log: 36,
  deferred_items: 34,
  diagnostic_only: 10,
  conditional_admissions: 32,
  task_local_forbidden: 12,
  task_local_instructions: 12,
  mutation_targets: 34
};

function addUniqueItem(items: CanonicalContinuityItem[], item: CanonicalContinuityItem): void {
  if (!item.text) return;
  const existing = items.find((candidate) =>
    isMeaningfullyDuplicate(candidate.text, item.text, 0.78)
  );
  if (!existing) {
    items.push(item);
    return;
  }
  if (BUCKET_PRIORITY[item.primary_bucket] > BUCKET_PRIORITY[existing.primary_bucket]) {
    const priorBucket = existing.primary_bucket;
    const mergedCrossRefs = new Set<ContinuityPrimaryBucket>([
      ...(existing.cross_refs ?? []),
      ...(item.cross_refs ?? []),
      priorBucket
    ]);
    mergedCrossRefs.delete(item.primary_bucket);
    Object.assign(existing, {
      ...item,
      cross_refs: Array.from(mergedCrossRefs)
    });
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
  extractionDegraded: boolean;
  extractionContaminationMarkers: string[];
  trustedSourceAvailable: boolean;
}): AdversarialGovernanceState {
  const canonicalItems: CanonicalContinuityItem[] = [];
  const trustedStable = input.trustedSourceAvailable
    ? trustedSummaryFrom(input.activeObjective, input.stableCore, input.parsed)
    : trustedSummaryFrom("", input.stableCore, input.parsed);
  const provider = providerLabel(input.request);

  for (const item of trustedStable) {
    addUniqueItem(
      canonicalItems,
      makeCanonicalItem(
        item,
        "stable_core",
        "admit",
        "trusted_state",
        "trusted_state",
        "accepted durable state",
        provider
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
        "open state is preserved",
        provider
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
        provider,
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
    byBucket("rejected_directions")
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
      item.primary_bucket === "quarantine_log" ||
      isExternalModelRole(item.source_role ?? "unknown") ||
      isRetrievedRole(item.source_role ?? "unknown") ||
      item.source_role === "transformed_review_output" ||
      item.source_role === "diagnostic_generated" ||
      item.source_role === "export_artifact" ||
      item.source_role === "exported_artifact_text"
  );
  const mutationTargets = uniqueCanonicalItems([
    ...byBucket("quarantine_log")
      .filter((item) => MUTATION_RE.test(item.text))
      .map((item) => item.text),
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
  if (input.extractionDegraded) {
    metricWarnings.push("Extraction degraded: body capture was too short, UI-heavy, or scaffold-dominant.");
  }
  if (input.extractionContaminationMarkers.length) {
    metricWarnings.push(
      `Extraction contamination markers: ${input.extractionContaminationMarkers.join(", ")}.`
    );
  }
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
      (item) => isExternalModelRole(item.source_role ?? "unknown")
    )
  ) {
    metricWarnings.push("Metric penalty applied due to assistant-authored state contamination.");
  }
  const assistantBlocked = canonicalItems.filter(
    (item) => isAssistantRole(item.source_role ?? "unknown") && item.decision !== "admit"
  );
  if (assistantBlocked.length) {
    metricWarnings.push(
      "Assistant/model output was considered and excluded from durable admission."
    );
  }
  const unknownDropped = canonicalItems.filter((item) => item.source_role === "unknown");
  if (unknownDropped.length) {
    metricWarnings.push("Unknown provenance failed closed and was kept out of durable state.");
  }
  const exportArtifactsBlocked = canonicalItems.filter(
    (item) =>
      item.source_role === "export_artifact" || item.source_role === "exported_artifact_text"
  );
  if (exportArtifactsBlocked.length) {
    metricWarnings.push("Review/export artifact text was blocked from trusted re-admission.");
  }
  if (
    canonicalItems.some(
      (item) => isChromeRole(item.source_role ?? "unknown") || isGenericUiChromeArtifact(item.text)
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
  const sourceCorpus = [input.sourceText, input.newInstructionText].filter(Boolean).join("\n");
  const likelyMissingCategories = [
    hasGovernanceSourceSignal(sourceCorpus) && governancePrinciples.length === 0
      ? "governance_principles"
      : "",
    hasInvariantSourceSignal(sourceCorpus) && invariants.length === 0 ? "invariants" : "",
    hasRejectedSourceSignal(sourceCorpus) && rejectedDirections.length === 0
      ? "rejected_directions"
      : "",
    hasContinuitySafeguardSourceSignal(sourceCorpus) && continuitySafeguards.length === 0
      ? "continuity_safeguards"
      : ""
  ].filter(Boolean);
  if (likelyMissingCategories.length) {
    metricWarnings.push(
      `Critical fidelity failure: likely source categories were not extracted (${likelyMissingCategories.join(", ")}).`
    );
  }
  const bucketCollisionsPrevented = canonicalItems.reduce(
    (count, item) => count + (item.cross_refs?.length ?? 0),
    0
  );
  if (bucketCollisionsPrevented > 0) {
    metricWarnings.push(
      `Bucket exclusivity collision(s) prevented: ${bucketCollisionsPrevented}.`
    );
  }
  const durableBuckets = new Set<ContinuityPrimaryBucket>([
    "stable_core",
    "provisional_state",
    "open_unresolved",
    "governance_principles",
    "invariants",
    "rejected_directions",
    "continuity_safeguards"
  ]);
  const admissionCounts: Record<string, number> = {
    admitted_durable: canonicalItems.filter(
      (item) => item.decision === "admit" && durableBuckets.has(item.primary_bucket)
    ).length,
    quarantined: canonicalItems.filter((item) => item.decision === "quarantine").length,
    rejected: canonicalItems.filter((item) => item.decision === "reject").length,
    unknown_dropped: unknownDropped.length,
    assistant_quarantined: assistantBlocked.length,
    chrome_dropped: canonicalItems.filter(
      (item) =>
        isChromeRole(item.source_role ?? "unknown") || isGenericUiChromeArtifact(item.text)
    ).length,
    user_authored_admitted_durable_items: canonicalItems.filter(
      (item) =>
        isUserAuthoredRole(item.source_role ?? "unknown") &&
        item.decision === "admit" &&
        durableBuckets.has(item.primary_bucket)
    ).length,
    assistant_generated_blocked_items: canonicalItems.filter(
      (item) => isAssistantRole(item.source_role ?? "unknown") && item.decision !== "admit"
    ).length,
    chrome_fragments_removed: canonicalItems.filter(
      (item) =>
        isChromeRole(item.source_role ?? "unknown") || isGenericUiChromeArtifact(item.text)
    ).length,
    duplicate_fragments_normalized: bucketCollisionsPrevented,
    bucket_collisions_prevented: bucketCollisionsPrevented,
    rejected_direction_items_preserved: rejectedDirections.length,
    unresolved_tension_items_preserved: byBucket("open_unresolved").length,
    exported_items_omitted_due_to_contamination: canonicalItems.filter(
      (item) =>
        item.primary_bucket === "diagnostic_only" ||
        item.primary_bucket === "quarantine_log" ||
        isChromeRole(item.source_role ?? "unknown") ||
        isExternalModelRole(item.source_role ?? "unknown") ||
        item.source_role === "export_artifact" ||
        item.source_role === "unknown"
    ).length
  };

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
    metric_warnings: metricWarnings,
    admission_counts: admissionCounts,
    duplicate_fragments_normalized: bucketCollisionsPrevented,
    bucket_collisions_prevented: bucketCollisionsPrevented,
    extraction_failure: likelyMissingCategories.length > 0 || input.extractionDegraded,
    extraction_degraded: input.extractionDegraded,
    extraction_contamination_markers: input.extractionContaminationMarkers.length
      ? input.extractionContaminationMarkers
      : undefined,
    likely_missing_categories: likelyMissingCategories.length ? likelyMissingCategories : undefined
  };
}

function isCoveredBy(existing: string[], candidate: string): boolean {
  return existing.some((item) => isMeaningfullyDuplicate(item, candidate, 0.72));
}

function isDurableStableCandidate(text: string): boolean {
  const clean = normalizeCanonicalText(text);
  if (
    !clean ||
    isGenericUiChromeArtifact(clean) ||
    isPromptScaffold(clean) ||
    isTaskLocalInstruction(clean) ||
    ASSISTANT_RECONSTRUCTION_RE.test(clean)
  ) {
    return false;
  }
  if (/^\s*(?:assistant|model|ai|system|developer)\s*:/i.test(text)) return false;
  if (
    /\b(?:assistant|model|gemini|claude|chatgpt|grok|deepseek|perplexity)\s+(?:said|responded|wrote|answered)\b/i.test(
      text
    )
  ) {
    return false;
  }
  if (isCategoryHeader(clean)) return false;
  if (/\b(framing note|role framing|conversational simulation|formal validation framework|architectural compliance matrix|external dependency expansion shall be enforced)\b/i.test(clean)) {
    return false;
  }
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

function isEligibleUserBodyStatement(text: string): boolean {
  const role = sourceRoleForStatement(text, "draft");
  return isUserAuthoredRole(role) && !isGenericUiChromeArtifact(text) && !isPromptScaffold(text);
}

function objectiveFromText(text: string, fallback = "Continue the active workflow."): string {
  const prepared = removeGeneratedRuntimeInstructions(text);
  const objectiveMatch = prepared.match(/(?:^|\n)\s*(?:[-*•]\s*)?(?:mission|objective):\s*([^\n]*)/i);
  const objective = objectiveMatch?.[1] ? stripSectionLabel(objectiveMatch[1]).slice(0, 240) : "";
  if (objective) return objective;

  const firstCandidate = prepared
    .split("\n")
    .map((line) => stripSectionLabel(line))
    .find(
      (line) =>
        line.length > 3 && !isRuntimeScaffoldLine(line) && isEligibleUserBodyStatement(line)
    );
  return (firstCandidate ?? firstMeaningfulLine(prepared, fallback)).slice(0, 240) || fallback;
}

function objectiveFromStatements(
  statements: GovernanceStatement[],
  fallbackText: string,
  fallback = "Continue the active workflow."
): string {
  const eligibleStatements = statements.filter(isEligibleUserStatement);
  if (statements.length > 0 && eligibleStatements.length === 0) {
    return fallback;
  }
  const sourceObjective = statements
    .filter(isEligibleUserStatement)
    .find(
      (statement) =>
        statement.sectionBucket === "stable_core" &&
        !isTaskLocalInstruction(statement.text) &&
        !isPromptScaffold(statement.text)
    );
  if (sourceObjective?.text) {
    return sourceObjective.text.slice(0, 240);
  }
  return objectiveFromText(fallbackText, fallback);
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
  extractionDegraded: boolean;
  extractionContaminationMarkers: string[];
}): ContinuityReview {
  const parsed = input.parsedCapsuleResult?.parsedCapsule;
  const newInstructionText = input.parsedCapsuleResult?.sourceWithoutCapsule ?? input.sourceText;
  const draftStatements = splitGovernanceStatements(newInstructionText, "draft");
  const userDraftStatements = draftStatements.filter(isEligibleUserStatement);
  const activeObjective =
    parsed?.active_objective ??
    objectiveFromStatements(draftStatements, input.normalized || input.reduced);
  const explicitlyRejectedStatements = userDraftStatements
    .filter((statement) => statement.sectionBucket === "rejected_directions")
    .map((statement) => statement.text);
  const reservedGovernanceStatements = userDraftStatements.filter((statement) =>
    isReservedGovernanceBucket(statement.sectionBucket)
  );
  const stableSourceStatements = userDraftStatements.filter(
    (statement) =>
      statement.sectionBucket === "stable_core" &&
      !isCoveredBy(explicitlyRejectedStatements, statement.text) &&
      isDurableStableCandidate(statement.text)
  );
  const hardConstraints = input.constraints
    .filter((constraint) => constraint.hard)
    .filter(
      (constraint) =>
        !/^\s*(governance principles?|governance principle|invariants?|invariant|rejected directions?|rejected direction|open questions?|open\/unresolved|quarantine|retrieved evidence|retrieval context|deferred items?)\s*:/i.test(
          cleanStateLine(constraint.text)
        )
    )
    .map((constraint) => normalizeCanonicalText(constraint.text))
    .filter(isDurableStableCandidate)
    .filter((constraint) => statementTextIsCovered(stableSourceStatements, constraint))
    .filter(
      (constraint) =>
        !explicitlyRejectedStatements.some((rejected) =>
          isMeaningfullyDuplicate(constraint, rejected, 0.74)
        )
    );
  const stableCore = uniqueMeaningfulStrings([
    ...statementTexts(stableSourceStatements),
    ...hardConstraints,
    ...(parsed?.stable_constraints.filter(isDurableStableCandidate) ?? []),
    ...(parsed?.accepted_decisions
      .map((item) => `Decision: ${item}`)
      .filter(isDurableStableCandidate) ?? [])
  ]).filter((item) => !isMeaningfullyDuplicate(item, activeObjective, 0.78));
  const openUnresolved = uniqueMeaningfulStrings([
    ...(parsed?.open_questions ?? []),
    ...(parsed?.unresolved_risks.map((item) => `Risk: ${item}`) ?? []),
    ...statementTexts(
      userDraftStatements.filter(
        (statement) => {
          if (isRetrievalContextLine(statement.text)) return false;
          const classification = bucketForGovernanceStatement(
            statement.text,
            statement.sectionBucket,
            statement.sourceRole
          );
          return (
            classification.bucket === "open_unresolved" ||
            (statement.sectionBucket === "open_unresolved" &&
              classification.decision !== "quarantine" &&
              classification.decision !== "reject") ||
            (/\?|open question|unclear|unknown|risk|unresolved|needs confirmation|tension/i.test(
              statement.text
            ) &&
              classification.bucket === "provisional_state")
          );
        }
      )
    )
  ]);
  const stableAndOpen = [activeObjective, ...stableCore, ...openUnresolved];
  const retrievedProvisional = input.retrievalContext.map(
    (item) => `Retrieved evidence (Provisional): ${item}`
  );
  const newProvisional = uniqueMeaningfulStrings([
    ...retrievedProvisional,
    ...statementTexts(
      userDraftStatements.filter(
        (statement) =>
          !isRetrievalContextLine(statement.text) &&
          !isReservedGovernanceBucket(statement.sectionBucket) &&
          statement.sectionBucket !== "stable_core" &&
          bucketForGovernanceStatement(
            statement.text,
            statement.sectionBucket,
            statement.sourceRole
          ).bucket === "provisional_state" &&
          !isCoveredBy(stableAndOpen, statement.text) &&
          !statementTextIsCovered(reservedGovernanceStatements, statement.text) &&
          !/^no new/i.test(statement.text)
      )
    )
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
    retrievalContext: input.retrievalContext,
    extractionDegraded: input.extractionDegraded,
    extractionContaminationMarkers: input.extractionContaminationMarkers,
    trustedSourceAvailable: userDraftStatements.length > 0 || Boolean(parsed)
  });
  const likelyMissingCategories = governanceState.likely_missing_categories ?? [];
  const omittedRejectedCount =
    hasRejectedSourceSignal(input.sourceText) && !governanceState.rejected_directions.length
      ? 1
      : 0;
  const unresolvedCollapsedCount =
    hasOpenStateSourceSignal(input.sourceText) && openUnresolved.length === 0
      ? 1
      : 0;
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
      metric_warnings: governanceState.metric_warnings,
      extraction_failure: governanceState.extraction_failure,
      extraction_degraded: governanceState.extraction_degraded,
      extraction_contamination_markers: governanceState.extraction_contamination_markers,
      fidelity_severity: governanceState.extraction_failure
        ? input.extractionDegraded
          ? "warning"
          : "critical"
        : "info",
      likely_missing_categories: likelyMissingCategories.length
        ? likelyMissingCategories
        : undefined,
      admission_counts: governanceState.admission_counts,
      compression_loss: {
        lost_categories: likelyMissingCategories,
        degraded_links: [],
        omitted_rationale_count: omittedRejectedCount,
        unresolved_items_collapsed_count: unresolvedCollapsedCount
      }
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
  const hasOpenSignal = hasOpenStateSourceSignal(request.sourceText);
  const hasMutationSignal =
    /\b(ignore previous|replace trusted|delete safeguards|suppress audit|false claim|hidden rewrite|state override|attempted mutation|attempted state override)\b/i.test(
      request.sourceText
    ) ||
    (/\b(?:override|replace|delete|suppress)\b/i.test(request.sourceText) &&
      !/\b(do not|must not|should not|never)\s+(?:override|replace|delete|suppress)\b/i.test(
        request.sourceText
      ));
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
  const hasRejectedSignal = hasRejectedSourceSignal(request.sourceText);
  const stableCanonical =
    governance?.canonical_items.filter((item) => item.primary_bucket === "stable_core") ?? [];
  const durableCanonical =
    governance?.canonical_items.filter((item) =>
      [
        "stable_core",
        "provisional_state",
        "open_unresolved",
        "governance_principles",
        "invariants",
        "rejected_directions",
        "continuity_safeguards"
      ].includes(item.primary_bucket)
    ) ?? [];
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
        (item) =>
          isChromeRole(item.source_role ?? "unknown") || isGenericUiChromeArtifact(item.text)
      ) ??
        false),
    assistantContamination:
      stableCanonical.some((item) => isExternalModelRole(item.source_role ?? "unknown")) ||
      review.stableCore.some((item) => ASSISTANT_RECONSTRUCTION_RE.test(item)) ||
      /(^|\n)\s*(assistant|model|ai)\s*:/i.test(review.stableCore.join("\n")),
    promptScaffoldingLeakage: [review.activeObjective, ...review.stableCore].some((item) =>
      isPromptScaffold(item)
    ),
    emptyGovernanceWhenPresent:
      hasGovernanceSignal && !(governance?.governance_principles.length ?? 0),
    emptyInvariantsWhenPresent: hasInvariantSignal && !(governance?.invariants.length ?? 0),
    emptyRejectionsWhenPresent:
      hasRejectedSignal && !(governance?.rejected_directions.length ?? 0),
    extractionFailure: review.diagnostics.extraction_failure,
    extractionDegraded:
      review.diagnostics.extraction_degraded ||
      request.providerHealth?.extraction_status === "degraded" ||
      request.providerHealth?.extraction_status === "failed",
    negativeStateLoss:
      (review.diagnostics.compression_loss?.lost_categories.includes("rejected_directions") ??
        false) ||
      (review.diagnostics.compression_loss?.unresolved_items_collapsed_count ?? 0) > 0,
    reviewOpenNotVisible:
      request.providerHealth?.review_open_status === "failed" ||
      Boolean(request.providerHealth?.failure_stage),
    categoryHeaderAdmission:
      governance?.canonical_items.some((item) => isCategoryHeader(item.text)) ?? false,
    taskLocalLeakage:
      review.stableCore.some((item) => isTaskLocalInstruction(item)) ||
      stableCanonical.some(
        (item) => item.primary_bucket === "stable_core" && isTaskLocalInstruction(item.text)
      ),
    unknownProvenanceDurable: durableCanonical.some((item) => item.source_role === "unknown"),
    exportArtifactReentry: durableCanonical.some(
      (item) =>
        item.source_role === "export_artifact" || item.source_role === "exported_artifact_text"
    ),
    majorTrustFailure:
      durableCanonical.some((item) => item.source_role === "unknown") ||
      stableCanonical.some((item) => isExternalModelRole(item.source_role ?? "unknown")) ||
      (hasInvariantSignal && !(governance?.invariants.length ?? 0)) ||
      (hasRejectedSignal && !(governance?.rejected_directions.length ?? 0))
  };
}

export function transformPrompt(request: TransformRequest): TransformResult {
  const requestProviderId = providerId(request);
  const preparedSource = prepareProviderSource(request.sourceText, request);
  const providerPreparedSource = preparedSource.text;
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
    retrievalContext: governedSource.retrievalContext,
    extractionDegraded: preparedSource.extractionDegraded,
    extractionContaminationMarkers: [
      ...preparedSource.contaminationMarkers,
      ...(request.providerHealth?.contamination_markers ?? [])
    ]
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
  review.diagnostics.export_readiness_decision =
    (scores.exportReadiness ?? 1) < 0.74 ||
    review.diagnostics.fidelity_severity === "critical"
      ? "UNSAFE_FOR_HANDOFF"
      : "READY_FOR_HANDOFF";
  const metricWarnings = uniqueMeaningfulStrings([
    ...(review.diagnostics.metric_warnings ?? []),
    ...(scores.warnings ?? []),
    review.diagnostics.export_readiness_decision === "UNSAFE_FOR_HANDOFF"
      ? "Export readiness downgraded: unsafe for handoff until fidelity issues are resolved."
      : ""
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
