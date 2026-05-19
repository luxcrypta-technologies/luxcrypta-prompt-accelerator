import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { TargetModel } from "@luxcrypta/continuity-types/models";
import type { ExtractedConstraint } from "@luxcrypta/continuity-types/prompts";

export function buildExplanation(input: {
  original: string;
  normalized: string;
  transformed: string;
  constraints: ExtractedConstraint[];
  mode?: ModeName;
  targetModel?: TargetModel;
}): string[] {
  const explanation = [
    "Ran the always-on continuity pipeline.",
    input.normalized.length < input.original.length
      ? "Reduced whitespace, repeated phrasing, and low-information setup."
      : "Kept wording intact where further reduction was not clearly safe.",
    input.constraints.length > 0
      ? `Preserved ${input.constraints.filter((constraint) => constraint.hard).length} likely hard requirement(s).`
      : "No explicit hard requirements were detected.",
    "Prioritized the active objective without exposing a user-selected mode.",
    input.targetModel
      ? `Applied ${input.targetModel} formatting preferences.`
      : "No target model formatting profile was applied.",
    input.transformed.includes("Objective:")
      ? "Changed the output structure to make the objective and requirements easier to review."
      : "Kept the output structure close to the compressed draft."
  ];

  return explanation;
}
