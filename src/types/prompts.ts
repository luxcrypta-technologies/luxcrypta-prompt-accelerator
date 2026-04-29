import type { DiffBlock } from "./diff";
import type { ModeName } from "./modes";
import type { TargetModel } from "./models";

export interface TransformRequest {
  sourceText: string;
  mode?: ModeName;
  targetModel?: TargetModel;
  preserveConstraints?: boolean;
  generateExplanation?: boolean;
  generateDiff?: boolean;
  sourceSurface?: string;
}

export interface ExtractedConstraint {
  id: string;
  text: string;
  kind:
    | "requirement"
    | "format"
    | "style"
    | "length"
    | "forbidden"
    | "tooling"
    | "output_contract"
    | "domain";
  hard: boolean;
  confidence: number;
}

export interface TransformationScores {
  redundancyScoreBefore: number;
  redundancyScoreAfter: number;
  compactnessScore: number;
  constraintPreservationScore: number;
  modeAlignmentScore?: number;
  adaptationAlignmentScore?: number;
  riskScore: number;
}

export interface TransformResult {
  originalText: string;
  normalizedText: string;
  transformedText: string;
  modeApplied?: ModeName;
  targetModelApplied?: TargetModel;
  extractedConstraints: ExtractedConstraint[];
  explanation: string[];
  diff: DiffBlock[];
  scores: TransformationScores;
}
