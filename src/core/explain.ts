import type { ModeName } from "@/types/modes";
import type { TargetModel } from "@/types/models";
import type { ExtractedConstraint } from "@/types/prompts";

export function buildExplanation(input: {
  original: string;
  normalized: string;
  transformed: string;
  constraints: ExtractedConstraint[];
  mode?: ModeName;
  targetModel?: TargetModel;
}): string[] {
  const explanation = [
    input.normalized.length < input.original.length
      ? "Shortened whitespace, repeated phrasing, or low-information setup."
      : "Kept the original wording mostly intact where compression was not clearly safe.",
    input.constraints.length > 0
      ? `Preserved ${input.constraints.filter((constraint) => constraint.hard).length} likely hard requirement(s).`
      : "No explicit hard requirements were detected.",
    input.mode ? `Applied ${input.mode.replace("_", " ")} mode.` : "No mode template was applied.",
    input.targetModel
      ? `Applied ${input.targetModel} formatting preferences.`
      : "No target model formatting profile was applied.",
    input.transformed.includes("Objective:")
      ? "Changed the output structure to make the objective and requirements easier to review."
      : "Kept the output structure close to the compressed draft."
  ];

  return explanation;
}
