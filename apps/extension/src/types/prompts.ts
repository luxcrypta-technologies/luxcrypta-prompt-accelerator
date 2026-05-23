import type { DiffBlock } from "./diff";
import type { CarryForwardCapsule } from "./capsules";
import type { ModeName } from "./modes";
import type { TargetModel } from "./models";
import type { ProviderHealth, ProviderProfile } from "./surfaces";

export interface TransformRequest {
  sourceText: string;
  mode?: ModeName;
  targetModel?: TargetModel;
  preserveConstraints?: boolean;
  generateExplanation?: boolean;
  generateDiff?: boolean;
  sourceSurface?: string;
  providerProfile?: ProviderProfile;
  providerHealth?: ProviderHealth;
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
  sourcePurityScore?: number;
  bucketExclusivityScore?: number;
  chromeContaminationScore?: number;
  assistantContaminationScore?: number;
  durableStatePrecision?: number;
  durableStateRecall?: number;
  durableRecallEstimate?: number;
  taskLocalLeakageScore?: number;
  governanceDetectionCompleteness?: number;
  invariantDetectionCompleteness?: number;
  negativeStatePreservation?: number;
  exportReadiness?: number;
  reviewTruthfulness?: number;
  modeAlignmentScore?: number;
  adaptationAlignmentScore?: number;
  riskScore: number;
  warnings?: string[];
}

export type GovernanceAdmissionDecision =
  | "reject"
  | "quarantine"
  | "defer"
  | "conditional_admit"
  | "admit";

export type ContinuityPrimaryBucket =
  | "stable_core"
  | "provisional_state"
  | "task_local_instructions"
  | "task_local_forbidden"
  | "open_unresolved"
  | "rejected_directions"
  | "quarantine_log"
  | "deferred_items"
  | "conditional_admissions"
  | "governance_principles"
  | "invariants"
  | "continuity_safeguards"
  | "mutation_targets"
  | "diagnostic_only";

export type ContinuitySourceRole =
  | "trusted_user_input"
  | "user_authored_input"
  | "assistant_output"
  | "provider_ui"
  | "provider_ui_chrome"
  | "extension_ui_chrome"
  | "retrieval_content"
  | "retrieved_external_content"
  | "diagnostic_generated"
  | "prior_review_state"
  | "transformed_review_output"
  | "export_artifact"
  | "exported_artifact_text"
  | "user_authored"
  | "user_quoted_prior_state"
  | "trusted_state"
  | "assistant_generated"
  | "external_model_output"
  | "retrieved_external"
  | "page_chrome"
  | "system_ui"
  | "extension_ui"
  | "unknown";

export interface CanonicalContinuityItem {
  id: string;
  text: string;
  primary_bucket: ContinuityPrimaryBucket;
  decision?: GovernanceAdmissionDecision;
  source?: string;
  source_role?: ContinuitySourceRole;
  provider?: string;
  extraction_path?: string;
  admission_reason?: string;
  blocked_reason?: string;
  confidence?: number;
  hard?: boolean;
  reason?: string;
  cross_refs?: ContinuityPrimaryBucket[];
}

export interface TrustedStateSummary {
  objective?: string;
  stable_core: string[];
  governance_principles: string[];
  invariants: string[];
  continuity_safeguards: string[];
}

export interface ConflictReport {
  has_conflict: boolean;
  trusted_summary: string[];
  untrusted_summary: string[];
  conflicts: string[];
  warnings: string[];
}

export interface MutationTarget {
  target_component: string;
  attempted_mutation: string;
  risk_level: "low" | "medium" | "high" | "critical";
  applied: boolean;
  reason: string;
}

export interface MutationRiskReport {
  mutation_targets: MutationTarget[];
  summary?: string;
  overall_attack_type?: string;
}

export interface AdversarialGovernanceState {
  trusted_state: TrustedStateSummary;
  untrusted_instructions: CanonicalContinuityItem[];
  quarantined_items: CanonicalContinuityItem[];
  deferred_items: CanonicalContinuityItem[];
  rejected_items: CanonicalContinuityItem[];
  admitted_updates: CanonicalContinuityItem[];
  conditional_admissions: CanonicalContinuityItem[];
  task_local_instructions: CanonicalContinuityItem[];
  task_local_forbidden: CanonicalContinuityItem[];
  governance_principles: string[];
  invariants: string[];
  continuity_safeguards: string[];
  rejected_directions: string[];
  quarantine_log: string[];
  mutation_targets: MutationTarget[];
  conflict_report: ConflictReport;
  mutation_risk_report: MutationRiskReport;
  canonical_items: CanonicalContinuityItem[];
  metric_warnings: string[];
  admission_counts?: Record<string, number>;
  duplicate_fragments_normalized?: number;
  bucket_collisions_prevented?: number;
  extraction_failure?: boolean;
  extraction_degraded?: boolean;
  extraction_contamination_markers?: string[];
  likely_missing_categories?: string[];
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
  providerProfile?: ProviderProfile;
  providerHealth?: ProviderHealth;
  retrievalContext?: string[];
  adversarialGovernance?: AdversarialGovernanceState;
  trusted_state_summary?: string[];
  untrusted_instruction_summary?: string[];
  task_local_instructions?: string[];
  task_local_forbidden?: string[];
  rejected_items?: string[];
  quarantined_items?: string[];
  deferred_items?: string[];
  conditional_admissions?: string[];
  mutation_risk_report?: MutationRiskReport;
  governance_principles?: string[];
  invariants?: string[];
  continuity_safeguards?: string[];
  metric_warnings?: string[];
  extraction_failure?: boolean;
  extraction_degraded?: boolean;
  extraction_contamination_markers?: string[];
  fidelity_severity?: "info" | "warning" | "critical";
  likely_missing_categories?: string[];
  admission_counts?: Record<string, number>;
  compression_loss?: {
    lost_categories: string[];
    degraded_links: string[];
    omitted_rationale_count: number;
    unresolved_items_collapsed_count: number;
  };
  export_readiness_decision?: "READY_FOR_HANDOFF" | "UNSAFE_FOR_HANDOFF";
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
