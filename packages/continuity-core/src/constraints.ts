import type { ExtractedConstraint } from "@luxcrypta/continuity-types/prompts";
import { createStableId } from "@luxcrypta/continuity-types/utils/ids";
import { uniqueMeaningfulStrings } from "@luxcrypta/continuity-types/utils/text";

const HARD_CUES = [
  "must",
  "do not",
  "don't",
  "avoid",
  "exactly",
  "required",
  "return as",
  "keep under",
  "only",
  "use",
  "json",
  "cite",
  "bullet points only",
  "step-by-step"
];

// Build a word-boundary matcher per cue so common cue words (use, only, cite)
// match as whole words / phrases and do NOT fire on substrings inside narration
// ("used", "lonely") or incidental mentions ("only 151kb").
const HARD_CUE_PATTERNS = HARD_CUES.map(
  (cue) => new RegExp(`(^|[^a-z])${cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i")
);

// Conversational narration is not a constraint, even if it incidentally contains
// a cue word. A line that is first-person musing, hedging, or an aside
// ("I don't have all the answers", "I have never really used an AI agent",
// "Prompt Accelerator is only 151kb", "for example, ...") must not be admitted
// as a durable constraint. Real constraints are directive, not narrative.
const NARRATION_RE =
  /^\s*(i\s+(?:don'?t|do not|never|have never|haven'?t|am|'m|was|wasn'?t|really|genuinely|think|guess|feel|believe|mean|want to (?:make sure|understand)|don'?t have|don'?t know)|in the meantime|for example|by the way|honestly|basically|i'?m not sure|maybe|perhaps|it (?:may|might) be)\b/i;

// A bare incidental quantity mention ("X is only 151kb", "it's only a demo") is
// narration, not a directive "only" constraint. Real "only" constraints are
// imperative ("use dumbbells only", "return only JSON").
const INCIDENTAL_ONLY_RE = /\bis\s+only\b|\bonly\s+\d/i;

function isDirectiveConstraint(candidate: string): boolean {
  const text = candidate.trim();
  if (NARRATION_RE.test(text)) return false;
  if (INCIDENTAL_ONLY_RE.test(text)) return false;
  return HARD_CUE_PATTERNS.some((pattern) => pattern.test(text));
}

function splitCandidates(text: string): string[] {
  const structured = text
    .replace(/\s+(requirements?|hard requirements?|output contract|context):\s*/gi, "\n$1:\n")
    .replace(/\s+[-*•]\s+/g, "\n- ");

  if (!text) return [];
  return structured
    .split(/\n|(?<=[.!?])\s+/)
    .map((candidate) =>
      candidate
        .replace(/^\s*[-*•]\s*/, "")
        .replace(/^\s*(requirements?|hard requirements?|output contract|context):\s*/i, "")
        .trim()
    )
    .filter((candidate) => candidate.length > 3);
}

function classify(text: string): ExtractedConstraint["kind"] {
  const lower = text.toLowerCase();
  if (/\b(do not|don't|avoid|never|without)\b/.test(lower)) return "forbidden";
  if (/\b(json|markdown|table|csv|yaml|return as|format|schema)\b/.test(lower)) return "output_contract";
  if (/\b(under|less than|max|minimum|exactly|words?|characters?)\b/.test(lower)) return "length";
  if (/\b(style|tone|voice|plain language|formal|casual)\b/.test(lower)) return "style";
  if (/\b(use|tool|typescript|react|python|api|package|library)\b/.test(lower)) return "tooling";
  if (/\b(cite|source|evidence|research|domain|legal|medical|finance)\b/.test(lower)) return "domain";
  if (/\b(bullet|step-by-step|section|heading|list)\b/.test(lower)) return "format";
  return "requirement";
}

function confidenceFor(text: string, hard: boolean): number {
  const lower = text.toLowerCase();
  let score = hard ? 0.72 : 0.48;
  if (/\b(must|exactly|required|only)\b/.test(lower)) score += 0.15;
  if (/\b(json|do not|avoid|keep under|return as)\b/.test(lower)) score += 0.12;
  if (text.length < 140) score += 0.04;
  return Math.min(0.98, Number(score.toFixed(2)));
}

export function extractConstraints(text: string): ExtractedConstraint[] {
  const candidates = splitCandidates(text);
  const constraintTexts = uniqueMeaningfulStrings(
    candidates.filter((candidate) => isDirectiveConstraint(candidate))
  );

  return constraintTexts.map((constraintText) => {
    const lower = constraintText.toLowerCase();
    const hard = /\b(must|do not|don't|avoid|exactly|required|only|json|keep under|return as)\b/.test(
      lower
    );
    return {
      id: createStableId("constraint", constraintText),
      text: constraintText,
      kind: classify(constraintText),
      hard,
      confidence: confidenceFor(constraintText, hard)
    };
  });
}
