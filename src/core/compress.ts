import type { ExtractedConstraint, TransformRequest } from "@/types/prompts";
import { toLines, uniqueStrings } from "@/utils/text";

const LOW_INFORMATION_PATTERNS = [
  /\bplease\b/gi,
  /\bif you can\b/gi,
  /\bi was wondering if\b/gi,
  /\bkind of\b/gi,
  /\bsort of\b/gi,
  /\bbasically\b/gi,
  /\breally\b/gi,
  /\bvery\b/gi,
  /\bjust\b/gi
];

function cleanLine(line: string): string {
  return LOW_INFORMATION_PATTERNS.reduce(
    (next, pattern) => next.replace(pattern, ""),
    line
  )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

function isConstraintLine(line: string, constraints: ExtractedConstraint[]): boolean {
  const lower = line.toLowerCase();
  return constraints.some((constraint) => lower.includes(constraint.text.toLowerCase()));
}

export function compressPrompt(
  normalized: string,
  constraints: ExtractedConstraint[],
  request: TransformRequest
): string {
  const preserveConstraints = request.preserveConstraints !== false;
  const lines = toLines(normalized).map(cleanLine).filter(Boolean);
  const uniqueLines = uniqueStrings(lines);
  const preservedConstraints = preserveConstraints
    ? constraints.filter((constraint) => constraint.hard).map((constraint) => constraint.text)
    : [];

  const bodyLines = uniqueLines.filter((line) => !isConstraintLine(line, constraints));
  const objective = bodyLines[0] ?? uniqueLines[0] ?? normalized;
  const details = bodyLines.slice(1).filter((line) => line.toLowerCase() !== objective.toLowerCase());

  const sections = [`Objective: ${objective}`];
  if (details.length > 0) {
    sections.push(`Context:\n${details.map((line) => `- ${line}`).join("\n")}`);
  }
  if (preservedConstraints.length > 0) {
    sections.push(`Requirements:\n${uniqueStrings(preservedConstraints).map((line) => `- ${line}`).join("\n")}`);
  }

  return sections.join("\n\n");
}
