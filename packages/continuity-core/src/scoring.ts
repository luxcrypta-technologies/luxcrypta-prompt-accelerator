import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { TargetModel } from "@luxcrypta/continuity-types/models";
import type { ExtractedConstraint, TransformationScores } from "@luxcrypta/continuity-types/prompts";

function redundancyScore(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z0-9']+\b/g) ?? [];
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return Number((1 - unique.size / words.length).toFixed(2));
}

function percent(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

export function computeTransformationScores(input: {
  original: string;
  transformed: string;
  constraints: ExtractedConstraint[];
  mode?: ModeName;
  targetModel?: TargetModel;
}): TransformationScores {
  const lowerTransformed = input.transformed.toLowerCase();
  const hardConstraints = input.constraints.filter((constraint) => constraint.hard);
  const preserved = hardConstraints.filter((constraint) =>
    lowerTransformed.includes(constraint.text.toLowerCase())
  );
  const constraintScore =
    hardConstraints.length === 0 ? 1 : preserved.length / Math.max(1, hardConstraints.length);
  const compactness = input.original.length === 0 ? 1 : 1 - input.transformed.length / (input.original.length * 1.8);
  const risk = 1 - constraintScore + (input.transformed.length === 0 ? 0.5 : 0);

  return {
    redundancyScoreBefore: redundancyScore(input.original),
    redundancyScoreAfter: redundancyScore(input.transformed),
    compactnessScore: percent(compactness),
    constraintPreservationScore: percent(constraintScore),
    modeAlignmentScore: input.mode ? 0.86 : undefined,
    adaptationAlignmentScore: input.targetModel ? 0.84 : undefined,
    riskScore: percent(risk)
  };
}
