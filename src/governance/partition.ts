import { extractConstraints } from "@/core/constraints";
import type { SessionUpdateInput } from "@/types/governance";
import type { ExtractedConstraint } from "@/types/prompts";
import { firstMeaningfulLine, isMeaningfullyDuplicate, uniqueMeaningfulStrings } from "@/utils/text";
import type { SessionCandidate, SessionPartition } from "./types";

const DECISION_RE = /\b(decided|decision|we will|chosen|approved|use|keep|ship|adopt)\b/i;
const OPEN_RE = /\?|open question|unclear|needs confirmation|still need|not sure|unknown/i;
const UNCERTAINTY_RE = /\b(uncertain|uncertainty|unknown|assumption|risk|may|might|where relevant|if relevant)\b/i;
const OPTIONAL_RE = /\b(optional|alternative|branch|variant|explore|creative|brainstorm|could also|consider)\b/i;
const OUTPUT_RE = /\b(json|markdown|table|csv|yaml|bullet|format|schema|return as|output)\b/i;

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
  return text.replace(/^\s*[-*•]?\s*(objective|requirements?|hard requirements?|output contract|context):\s*/i, "").trim();
}

function outputFragment(text: string): string {
  const fragment = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => stripLabel(sentence))
    .find((sentence) => OUTPUT_RE.test(sentence));
  return fragment ?? stripLabel(text);
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
  const objectiveMatch = text.match(/(?:^|\n)\s*objective:\s*(.+)/i);
  if (objectiveMatch?.[1]) return stripLabel(objectiveMatch[1]).slice(0, 220);
  const firstLine = text
    .split("\n")
    .map((line) => stripLabel(line))
    .find((line) => line.length > 3);
  const firstSentence = firstLine?.match(/^.+?[.!?](?:\s|$)/)?.[0].trim();
  return firstSentence?.slice(0, 220) || firstLine?.slice(0, 220) || firstMeaningfulLine(text, "").slice(0, 220) || null;
}

function candidatesFromConstraints(
  constraints: ExtractedConstraint[],
  source: SessionCandidate["source"]
): SessionCandidate[] {
  return constraints.map((constraint) =>
    asCandidate(
      stripLabel(constraint.text),
      constraint.kind === "output_contract" || constraint.kind === "format" ? "output_contract" : "constraint",
      source,
      constraint.confidence
    )
  );
}

function candidatesFromText(text: string, source: SessionCandidate["source"]): SessionCandidate[] {
  const candidates: SessionCandidate[] = [];
  const objective = objectiveFromText(text);
  if (objective) candidates.push(asCandidate(objective, "objective", source, 0.68));

  candidates.push(...candidatesFromConstraints(extractConstraints(text), source));

  for (const line of splitLines(text)) {
    const cleanLine = stripLabel(line);
    if (DECISION_RE.test(cleanLine)) candidates.push(asCandidate(cleanLine, "decision", source, 0.62));
    if (OPEN_RE.test(cleanLine)) candidates.push(asCandidate(cleanLine, "open_question", source, 0.72));
    if (UNCERTAINTY_RE.test(cleanLine)) candidates.push(asCandidate(cleanLine, "uncertainty", source, 0.66));
    if (OPTIONAL_RE.test(cleanLine)) candidates.push(asCandidate(cleanLine, "optional_branch", source, 0.58));
    if (OUTPUT_RE.test(cleanLine)) candidates.push(asCandidate(outputFragment(cleanLine), "output_contract", source, 0.6));
  }

  return candidates;
}

function dedupeCandidates(candidates: SessionCandidate[]): SessionCandidate[] {
  const output: SessionCandidate[] = [];
  for (const candidate of candidates) {
    const duplicate = output.some(
      (existing) => existing.kind === candidate.kind && isMeaningfullyDuplicate(existing.text, candidate.text, 0.74)
    );
    if (duplicate) continue;
    output.push(candidate);
  }
  return output.filter((candidate) => {
    if (candidate.kind !== "objective") return true;
    const duplicatesStableCandidate = output.some(
      (other) =>
        other !== candidate &&
        (other.kind === "constraint" || other.kind === "output_contract") &&
        isMeaningfullyDuplicate(other.text, candidate.text, 0.82)
    );
    if (duplicatesStableCandidate) return false;
    return true;
  });
}

export function extractSessionCandidates(input: SessionUpdateInput): SessionCandidate[] {
  const candidates: SessionCandidate[] = [];

  if (input.transformRequest?.sourceText) {
    candidates.push(...candidatesFromText(input.transformRequest.sourceText, "draft"));
  }
  if (input.transformResult) {
    candidates.push(...candidatesFromConstraints(input.transformResult.extractedConstraints, "transform"));
    candidates.push(...candidatesFromText(input.transformResult.transformedText, "transform"));
  }
  if (input.capsule) {
    candidates.push(asCandidate(input.capsule.objective, "objective", "capsule", 0.78));
    candidates.push(...input.capsule.constraints.map((item) => asCandidate(item, "constraint", "capsule", 0.78)));
    candidates.push(...input.capsule.decisions.map((item) => asCandidate(item, "decision", "capsule", 0.72)));
    candidates.push(...input.capsule.open_questions.map((item) => asCandidate(item, "open_question", "capsule", 0.76)));
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
  const stableKinds: SessionCandidate["kind"][] = ["objective", "constraint", "decision", "output_contract"];
  const opennessKinds: SessionCandidate["kind"][] = ["open_question", "uncertainty", "optional_branch"];

  return {
    stableCandidates: candidates.filter((candidate) => stableKinds.includes(candidate.kind)),
    noveltyCandidates: candidates.filter(
      (candidate) => candidate.kind === "objective" || candidate.kind === "constraint" || candidate.kind === "output_contract"
    ),
    opennessCandidates: candidates.filter((candidate) => opennessKinds.includes(candidate.kind))
  };
}

export function uniqueCandidateTexts(candidates: SessionCandidate[], kind: SessionCandidate["kind"]): string[] {
  return uniqueMeaningfulStrings(candidates.filter((candidate) => candidate.kind === kind).map((candidate) => candidate.text));
}
