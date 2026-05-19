import type { DiffBlock } from "./diff";
import type { CarryForwardCapsule } from "./capsules";
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

export interface ParsedCapsuleState {
  active_objective?: string;
  stable_constraints: string[];
  accepted_decisions: string[];
  open_questions: string[];
  unresolved_risks: string[];
  preferred_mode?: ModeName;
  explicit_next_actions: string[];
  notes: string[];
  provider_target?: string;
  metadata: {
    id?: string;
    title?: string;
    capsule_version?: number;
    created_at?: string;
    updated_at?: string;
    sourceSurface?: string;
  };
}

export interface ContinuityDiagnostics {
  pipelineSteps: string[];
  parsedCapsule?: ParsedCapsuleState;
  rawCapsule?: CarryForwardCapsule;
  sourceSurface?: string;
  requestedMode?: ModeName;
  targetModel?: TargetModel;
}

export interface ContinuityReview {
  cleanSummary: string;
  activeObjective: string;
  stableCore: string[];
  newProvisional: string[];
  openUnresolved: string[];
  whatChanged: string[];
  recommendedNextActions: string[];
  diagnostics: ContinuityDiagnostics;
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
  continuityReview: ContinuityReview;
}
