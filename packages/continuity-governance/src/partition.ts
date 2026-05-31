import { extractConstraints } from "@luxcrypta/continuity-core/constraints";
import type { SessionUpdateInput } from "@luxcrypta/continuity-types/governance";
import type { ExtractedConstraint } from "@luxcrypta/continuity-types/prompts";
import {
  firstMeaningfulLine,
  isMeaningfullyDuplicate,
  uniqueMeaningfulStrings
} from "@luxcrypta/continuity-types/utils/text";
import type { SessionCandidate, SessionPartition } from "./types";

const DECISION_RE = /\b(decided|decision|we will|chosen|approved|use|keep|ship|adopt)\b/i;
const OPEN_RE = /\?|open question|unclear|needs confirmation|still need|not sure|unknown|torn between|leave (?:that|it|this) open|don'?t decide|haven'?t decided|undecided|leave open for now|to be decided|still deciding|flag (?:that|this) as an assumption/i;
const UNCERTAINTY_RE =
  /\b(uncertain|uncertainty|unknown|assumption|risk|may|might|where relevant|if relevant)\b/i;
const OPTIONAL_RE =
  /\b(optional|alternative|branch|variant|explore|creative|brainstorm|could also|consider)\b/i;
const OUTPUT_RE = /\b(json|markdown|table|csv|yaml|bullet|format|schema|return as|output)\b/i;
// Standing/durable constraints: persistent assumptions and hard requirements.
// "Always assume X", "X is non-negotiable", "every recommendation must ...",
// "must include ...". These are durable ARC constraints, not one-off content.
const STANDING_CONSTRAINT_RE =
  /\b(always (?:assume|use|include|keep)|(?:is|are) non[-\s]?negotiable|every (?:recommendation|place|option|item|result)\b.*\bmust\b|must (?:always )?include|must be reachable|hard requirement)\b/i;
const TASK_LOCAL_RE =
  /\b(follow the required format|end with (?:a )?(?:score|rating)|give (?:a )?table|use (?:a )?table|separate into \d+ sections?|build a priority model|stage \d+|final scores?|reconstruction confidence score|respond with|answer format)\b/i;
const ASSISTANT_SOURCE_RE = /^\s*(assistant|model|ai)\s*:/i;
const SCAFFOLD_RE =
  /\b(below is|here is|structured response|copy[-\s]?paste|prompt block|final scores?|stage \d+)\b/i;

function splitLines(text: string): string[] {
  const structured = text
    .replace(/\s+(requirements?|hard requirements?|output contract|context):\s*/gi, "\n$1:\n")
    .replace(/\s+[-*•]\s+/g, "\n- ");
  return structured
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^- /, "").trim())
    .filter((line) => line.length > 3);
}

function stripLabel(text: string): string {
  return text
    .replace(
      /^\s*[-*•]?\s*(objective|requirements?|hard requirements?|output contract|context):\s*/i,
      ""
    )
    .trim();
}

function outputFragment(text: string): string {
  const fragment = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => stripLabel(sentence))
    .find((sentence) => OUTPUT_RE.test(sentence));
  return fragment ?? stripLabel(text);
}

function isTaskLocalInstruction(text: string): boolean {
  // D6 fix: a fragment is task-local ONLY when it is a genuine ephemeral
  // directive for the next reply (e.g. "respond with a table", "this reply
  // only..."). Merely containing an output/format word (json/markdown/table)
  // does NOT make it task-local — "keep the itinerary as a markdown table" is a
  // durable output contract, not ephemeral. We gate on the ephemeral pattern,
  // not on OUTPUT_RE, and still let durable signals override.
  const ephemeral =
    TASK_LOCAL_RE.test(text) ||
    /\b(for (?:this|the next) (?:reply|response|answer|message) only|just this once|only this time)\b/i.test(
      text
    );
  if (!ephemeral) return false;
  const durableSignals =
    /\b(durable|stable|governance|invariant|continuity|trusted state|carry[-\s]?forward|every (?:recommendation|place|option|item)|always|must (?:include|be)|non[-\s]?negotiable)\b/i.test(
      text
    );
  return !durableSignals;
}

function isAdmissibleSourceLine(text: string): boolean {
  return !ASSISTANT_SOURCE_RE.test(text) && !SCAFFOLD_RE.test(text);
}

function asCandidate(
  text: string,
  kind: SessionCandidate["kind"],
  source: SessionCandidate["source"],
  confidence = 0.72
): SessionCandidate {
  return { text: text.trim(), kind, source, confidence };
}

function objectiveFromText(text: string): string | null {
  const isNonObjectiveLine = (line: string): boolean =>
    STANDING_CONSTRAINT_RE.test(line) ||
    OPEN_RE.test(line) ||
    /^\s*(don'?t|do not|never|avoid)\b/i.test(line) ||
    /\bnon[-\s]?negotiable\b/i.test(line);
  const objectiveMatch = text.match(/(?:^|\n)\s*objective:\s*(.+)/i);
  if (objectiveMatch?.[1]) {
    const labeled = stripLabel(objectiveMatch[1]).slice(0, 220);
    // Even an explicit "Objective:" line is not the objective if its content is
    // itself a standing constraint / open question / rejection (the pipeline
    // sometimes labels a single-line constraint turn as "Objective:").
    if (labeled && !isNonObjectiveLine(labeled)) return labeled;
  }
  // A line that is itself a standing constraint, an open question, an explicit
  // rejection, or a hard requirement is NOT the session objective — it belongs
  // in its own bucket. Skipping these here prevents e.g. "Always assume two
  // adults" or "Don't include bus tours" from hijacking/replacing the objective.
  const firstLine = text
    .split("\n")
    .map((line) => stripLabel(line))
    .find(
      (line) =>
        line.length > 3 &&
        !/^(mode|task):\s*/i.test(line) &&
        isAdmissibleSourceLine(line) &&
        !isNonObjectiveLine(line)
    );
  const firstSentence = firstLine?.match(/^.+?[.!?](?:\s|$)/)?.[0].trim();
  return (
    firstSentence?.slice(0, 220) ||
    firstLine?.slice(0, 220) ||
    firstMeaningfulLine(text, "").slice(0, 220) ||
    null
  );
}

function candidatesFromConstraints(
  constraints: ExtractedConstraint[],
  source: SessionCandidate["source"]
): SessionCandidate[] {
  return constraints.map((constraint) =>
    asCandidate(
      stripLabel(constraint.text),
      constraint.kind === "output_contract" || constraint.kind === "format"
        ? "output_contract"
        : "constraint",
      source,
      constraint.confidence
    )
  );
}

function candidatesFromText(text: string, source: SessionCandidate["source"]): SessionCandidate[] {
  const candidates: SessionCandidate[] = [];
  const objective = objectiveFromText(text);
  // Defensive: never admit an "objective" candidate whose LEADING clause is
  // itself a standing constraint / open question / rejection. We test only the
  // first sentence so a valid objective ("Build a research prompt.") that is
  // followed by constraint/question sentences is not over-rejected.
  const objectiveLead = objective?.split(/(?<=[.!?])\s+/)[0] ?? objective ?? "";
  if (
    objective &&
    !STANDING_CONSTRAINT_RE.test(objectiveLead) &&
    !OPEN_RE.test(objectiveLead) &&
    !/^\s*(don'?t|do not|never|avoid)\b/i.test(objectiveLead) &&
    !/\bnon[-\s]?negotiable\b/i.test(objectiveLead)
  ) {
    candidates.push(asCandidate(objective, "objective", source, 0.68));
  }

  candidates.push(...candidatesFromConstraints(extractConstraints(text), source));

  for (const line of splitLines(text)) {
    const cleanLine = stripLabel(line);
    if (!isAdmissibleSourceLine(cleanLine)) continue;
    if (isTaskLocalInstruction(cleanLine)) {
      candidates.push(asCandidate(cleanLine, "task_local_instruction", source, 0.58));
      continue;
    }
    if (DECISION_RE.test(cleanLine))
      candidates.push(asCandidate(cleanLine, "decision", source, 0.62));
    if (OPEN_RE.test(cleanLine))
      candidates.push(asCandidate(cleanLine, "open_question", source, 0.72));
    if (UNCERTAINTY_RE.test(cleanLine))
      candidates.push(asCandidate(cleanLine, "uncertainty", source, 0.66));
    if (OPTIONAL_RE.test(cleanLine))
      candidates.push(asCandidate(cleanLine, "optional_branch", source, 0.58));
    if (OUTPUT_RE.test(cleanLine))
      candidates.push(asCandidate(outputFragment(cleanLine), "output_contract", source, 0.6));
    if (STANDING_CONSTRAINT_RE.test(cleanLine) && !OUTPUT_RE.test(cleanLine))
      candidates.push(asCandidate(cleanLine, "constraint", source, 0.66));
  }

  return candidates;
}

function dedupeCandidates(candidates: SessionCandidate[]): SessionCandidate[] {
  const output: SessionCandidate[] = [];
  for (const candidate of candidates) {
    const duplicate = output.some(
      (existing) =>
        existing.kind === candidate.kind &&
        isMeaningfullyDuplicate(existing.text, candidate.text, 0.74)
    );
    if (duplicate) continue;
    output.push(candidate);
  }
  return output.filter((candidate) => {
    if (candidate.kind !== "objective") return true;
    // D11 fix: previously an objective that overlapped a constraint/output
    // candidate was DROPPED entirely, which could erase a legitimate objective.
    // We keep the objective; bucket routing assigns the strongest primary
    // bucket downstream. Only drop an objective that is an exact duplicate of
    // another objective (handled by the kind-equal dedupe above).
    return true;
  });
}

export function extractSessionCandidates(input: SessionUpdateInput): SessionCandidate[] {
  const candidates: SessionCandidate[] = [];

  if (input.transformRequest?.sourceText) {
    candidates.push(...candidatesFromText(input.transformRequest.sourceText, "draft"));
  }
  if (input.transformResult) {
    candidates.push(
      ...candidatesFromConstraints(input.transformResult.extractedConstraints, "transform")
    );
    candidates.push(...candidatesFromText(input.transformResult.transformedText, "transform"));
  }
  if (input.capsule) {
    candidates.push(asCandidate(input.capsule.objective, "objective", "capsule", 0.78));
    candidates.push(
      ...input.capsule.constraints.map((item) => asCandidate(item, "constraint", "capsule", 0.78))
    );
    candidates.push(
      ...input.capsule.decisions.map((item) => asCandidate(item, "decision", "capsule", 0.72))
    );
    candidates.push(
      ...input.capsule.open_questions.map((item) =>
        asCandidate(item, "open_question", "capsule", 0.76)
      )
    );
  }
  if (input.conversationSnapshot?.turns.length) {
    const userText = input.conversationSnapshot.turns
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text)
      .join("\n");
    candidates.push(...candidatesFromText(userText, "manual"));
  }

  return dedupeCandidates(candidates).slice(0, 60);
}

export function partitionSessionCandidates(candidates: SessionCandidate[]): SessionPartition {
  const stableKinds: SessionCandidate["kind"][] = [
    "objective",
    "constraint",
    "decision",
    "output_contract"
  ];
  const opennessKinds: SessionCandidate["kind"][] = [
    "open_question",
    "uncertainty",
    "optional_branch"
  ];

  return {
    stableCandidates: candidates.filter((candidate) => stableKinds.includes(candidate.kind)),
    // Novelty candidates include the stable kinds so that genuine *changes* and
    // *additions* can be detected. The novelty lane's noveltyKind() is the real
    // gatekeeper: it returns null for anything already covered by the stable
    // core (isCoveredByStableCore), so established stable state never enters the
    // lane. The D7 double-count (stable inflating noveltyLoad) is fixed in
    // monitors.ts, where the metric is computed off the already-filtered lane —
    // NOT by stripping candidates here, which would break change detection.
    noveltyCandidates: candidates.filter(
      (candidate) =>
        candidate.kind === "objective" ||
        candidate.kind === "constraint" ||
        candidate.kind === "output_contract" ||
        candidate.kind === "task_local_instruction"
    ),
    opennessCandidates: candidates.filter((candidate) => opennessKinds.includes(candidate.kind))
  };
}

export function uniqueCandidateTexts(
  candidates: SessionCandidate[],
  kind: SessionCandidate["kind"]
): string[] {
  return uniqueMeaningfulStrings(
    candidates.filter((candidate) => candidate.kind === kind).map((candidate) => candidate.text)
  );
}
