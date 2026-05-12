import type { ExtractedConstraint } from "@/types/prompts";
import { createStableId } from "@/utils/ids";
import { uniqueMeaningfulStrings } from "@/utils/text";

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
    candidates.filter((candidate) => {
      const lower = candidate.toLowerCase();
      return HARD_CUES.some((cue) => lower.includes(cue));
    })
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
