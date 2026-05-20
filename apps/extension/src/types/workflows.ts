import type { ModeName } from "./modes";
import type { TargetModel } from "./models";

export interface Workflow {
  id: string;
  workflow_id?: string;
  version?: 1;
  title: string;
  source_platform?: string;
  detected_model?: string;
  objective: string;
  active_objective?: string;
  mode: ModeName;
  constraints: string[];
  stable_constraints?: string[];
  accepted_decisions?: string[];
  unresolved_issues?: string[];
  provisional_state?: string[];
  continuity_review?: Record<string, unknown>;
  continuity_state_history?: Record<string, unknown>[];
  workflow_evolution?: Record<string, unknown>[];
  diagnostic_data?: Record<string, unknown>;
  risk_scores?: Record<string, unknown>;
  compression_metrics?: Record<string, unknown>;
  constraint_integrity_metrics?: Record<string, unknown>;
  session_metadata?: Record<string, unknown>;
  platform_metadata?: Record<string, unknown>;
  outputPreferences: string[];
  carryForwardContext?: string;
  targetModel?: TargetModel;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}
