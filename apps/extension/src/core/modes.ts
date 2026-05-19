import type { ModeName } from "@/types/modes";
import type { ExtractedConstraint } from "@/types/prompts";
import { isMeaningfullyDuplicate, uniqueMeaningfulStrings } from "@/utils/text";

function textAlreadyCoversRequirement(text: string, requirement: string): boolean {
  return text
    .replace(/\s+(requirements?|hard requirements?|output contract):\s*/gi, "\n$1:\n")
    .split(/\n|(?<=[.!?])\s+/)
    .some((line) => isMeaningfullyDuplicate(line, requirement, 0.68));
}

function requirementBlock(constraints: ExtractedConstraint[], existingText: string): string {
  const hard = uniqueMeaningfulStrings(
    constraints.filter((constraint) => constraint.hard).map((constraint) => constraint.text)
  ).filter((constraint) => !textAlreadyCoversRequirement(existingText, constraint));
  if (hard.length === 0) {
    return "";
  }
  return `\n\nHard requirements:\n${hard.map((constraint) => `- ${constraint}`).join("\n")}`;
}

export function applyModeTemplate(
  text: string,
  mode: ModeName | undefined,
  constraints: ExtractedConstraint[]
): string {
  if (!mode) {
    return text;
  }

  const requirements = requirementBlock(constraints, text);

  switch (mode) {
    case "focus":
      return `Prioritize the main objective.\n\n${text}${requirements}`;
    case "speed":
      return `Answer quickly with only the useful essentials.\n\n${text}${requirements}`;
    case "precision":
      return `Be precise. State assumptions, requirements, and the output contract clearly.\n\n${text}${requirements}`;
    case "creative":
      return `Explore strong options while respecting the stated boundaries.\n\n${text}${requirements}`;
    case "debate":
      return `Compare the strongest views.\n\nInclude:\n- Best case for each side\n- Tradeoffs\n- Counterarguments\n- Recommendation\n\n${text}${requirements}`;
    case "research":
      return `Analyze the topic with clear uncertainty handling.\n\nInclude:\n- Key findings\n- Evidence or sources when relevant\n- Alternatives\n- Open questions\n\n${text}${requirements}`;
    case "code":
      return `Implementation task.\n\nInclude:\n- Assumptions\n- File or API changes\n- Tests\n- Risks\n\n${text}${requirements}`;
    case "executive_summary":
      return `Start with a short summary.\n\nInclude:\n- Recommendation\n- Key risks\n- Options\n- Next step\n\n${text}${requirements}`;
  }
}
