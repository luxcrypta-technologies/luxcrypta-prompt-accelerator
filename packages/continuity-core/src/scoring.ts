import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { TargetModel } from "@luxcrypta/continuity-types/models";
import type {
  ExtractedConstraint,
  TransformationScores
} from "@luxcrypta/continuity-types/prompts";

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
  penalties?: {
    writebackFailed?: boolean;
    fieldContamination?: boolean;
    bucketOverlap?: boolean;
    rejectedDirectionAmbiguity?: boolean;
    weakTrustedSeparation?: boolean;
    lostOpenState?: boolean;
    weakObjectiveNormalization?: boolean;
    missingMutationHandling?: boolean;
    emptyStateCollapse?: boolean;
    chromeContamination?: boolean;
    assistantContamination?: boolean;
    promptScaffoldingLeakage?: boolean;
    emptyGovernanceWhenPresent?: boolean;
    emptyInvariantsWhenPresent?: boolean;
    categoryHeaderAdmission?: boolean;
    taskLocalLeakage?: boolean;
  };
}): TransformationScores {
  const lowerTransformed = input.transformed.toLowerCase();
  const hardConstraints = input.constraints.filter((constraint) => constraint.hard);
  const preserved = hardConstraints.filter((constraint) =>
    lowerTransformed.includes(constraint.text.toLowerCase())
  );
  const baseConstraintScore =
    hardConstraints.length === 0 ? 1 : preserved.length / Math.max(1, hardConstraints.length);
  const compactness =
    input.original.length === 0 ? 1 : 1 - input.transformed.length / (input.original.length * 1.8);
  const warnings: string[] = [];
  let constraintPenalty = 0;
  let riskPenalty = 0;

  if (input.penalties?.writebackFailed) {
    warnings.push("Metric penalty applied due to writeback failure.");
    constraintPenalty += 0.1;
    riskPenalty += 0.18;
  }
  if (input.penalties?.bucketOverlap) {
    warnings.push("Metric penalty applied due to bucket overlap.");
    constraintPenalty += 0.12;
    riskPenalty += 0.12;
  }
  if (input.penalties?.rejectedDirectionAmbiguity) {
    warnings.push("Metric penalty applied due to rejected-direction taxonomy ambiguity.");
    constraintPenalty += 0.08;
    riskPenalty += 0.1;
  }
  if (input.penalties?.fieldContamination) {
    warnings.push("Metric penalty applied due to field contamination.");
    constraintPenalty += 0.08;
    riskPenalty += 0.1;
  }
  if (input.penalties?.weakTrustedSeparation) {
    warnings.push("Metric penalty applied due to weak trusted/untrusted separation.");
    constraintPenalty += 0.12;
    riskPenalty += 0.16;
  }
  if (input.penalties?.lostOpenState) {
    warnings.push("Metric penalty applied due to lost open state.");
    constraintPenalty += 0.06;
    riskPenalty += 0.08;
  }
  if (input.penalties?.weakObjectiveNormalization) {
    warnings.push("Metric penalty applied due to weak objective normalization.");
    constraintPenalty += 0.05;
    riskPenalty += 0.05;
  }
  if (input.penalties?.missingMutationHandling) {
    warnings.push("Metric penalty applied due to weak mutation handling.");
    riskPenalty += 0.14;
  }
  if (input.penalties?.emptyStateCollapse) {
    warnings.push("Metric penalty applied due to empty-state collapse.");
    constraintPenalty += 0.2;
    riskPenalty += 0.28;
  }
  if (input.penalties?.chromeContamination) {
    warnings.push("Metric penalty applied due to page chrome contamination.");
    constraintPenalty += 0.16;
    riskPenalty += 0.22;
  }
  if (input.penalties?.assistantContamination) {
    warnings.push("Metric penalty applied due to assistant-authored state contamination.");
    constraintPenalty += 0.18;
    riskPenalty += 0.24;
  }
  if (input.penalties?.promptScaffoldingLeakage) {
    warnings.push("Metric penalty applied due to prompt scaffolding admitted as state.");
    constraintPenalty += 0.12;
    riskPenalty += 0.14;
  }
  if (input.penalties?.emptyGovernanceWhenPresent) {
    warnings.push("Metric penalty applied due to governance loss.");
    constraintPenalty += 0.1;
    riskPenalty += 0.12;
  }
  if (input.penalties?.emptyInvariantsWhenPresent) {
    warnings.push("Metric penalty applied due to invariant loss.");
    constraintPenalty += 0.1;
    riskPenalty += 0.12;
  }
  if (input.penalties?.categoryHeaderAdmission) {
    warnings.push("Metric penalty applied due to category header admission.");
    constraintPenalty += 0.1;
    riskPenalty += 0.12;
  }
  if (input.penalties?.taskLocalLeakage) {
    warnings.push(
      "Metric penalty applied due to task-local instructions leaking into durable state."
    );
    constraintPenalty += 0.12;
    riskPenalty += 0.14;
  }

  const constraintScore = Math.max(0, baseConstraintScore - constraintPenalty);
  const risk = 1 - constraintScore + (input.transformed.length === 0 ? 0.5 : 0) + riskPenalty;
  const sourcePurityPenalty =
    (input.penalties?.fieldContamination ? 0.16 : 0) +
    (input.penalties?.chromeContamination ? 0.28 : 0) +
    (input.penalties?.assistantContamination ? 0.26 : 0) +
    (input.penalties?.weakTrustedSeparation ? 0.18 : 0);
  const bucketPenalty =
    (input.penalties?.bucketOverlap ? 0.34 : 0) +
    (input.penalties?.rejectedDirectionAmbiguity ? 0.24 : 0) +
    (input.penalties?.categoryHeaderAdmission ? 0.18 : 0);
  const precisionPenalty =
    (input.penalties?.promptScaffoldingLeakage ? 0.22 : 0) +
    (input.penalties?.taskLocalLeakage ? 0.24 : 0) +
    (input.penalties?.assistantContamination ? 0.24 : 0) +
    (input.penalties?.chromeContamination ? 0.24 : 0);
  const recallPenalty =
    (input.penalties?.emptyStateCollapse ? 0.38 : 0) +
    (input.penalties?.emptyGovernanceWhenPresent ? 0.22 : 0) +
    (input.penalties?.emptyInvariantsWhenPresent ? 0.22 : 0) +
    (input.penalties?.lostOpenState ? 0.16 : 0);

  return {
    redundancyScoreBefore: redundancyScore(input.original),
    redundancyScoreAfter: redundancyScore(input.transformed),
    compactnessScore: percent(compactness),
    constraintPreservationScore: percent(constraintScore),
    sourcePurityScore: percent(1 - sourcePurityPenalty),
    bucketExclusivityScore: percent(1 - bucketPenalty),
    chromeContaminationScore: percent(
      input.penalties?.chromeContamination ? 1 : input.penalties?.fieldContamination ? 0.45 : 0
    ),
    assistantContaminationScore: percent(input.penalties?.assistantContamination ? 1 : 0),
    durableStatePrecision: percent(1 - precisionPenalty),
    durableStateRecall: percent(1 - recallPenalty),
    taskLocalLeakageScore: percent(input.penalties?.taskLocalLeakage ? 1 : 0),
    modeAlignmentScore: input.mode ? 0.86 : undefined,
    adaptationAlignmentScore: input.targetModel ? 0.84 : undefined,
    riskScore: percent(risk),
    warnings: warnings.length ? warnings : undefined
  };
}
