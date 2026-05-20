import type { TargetModel } from "./models";

export interface StateVersionRef {
  id: string;
  created_at: string;
  summary?: string;
}

export interface WorkflowState {
  workflow_id: string;
  title: string;
  platform: string;
  created_at: string;
  updated_at: string;
  extension_version: string;
  continuity_score?: number;
  risk_score?: number;
  compression_score?: number;
  active_capsule_id?: string;
  state_versions: StateVersionRef[];
  diagnostic_history: string[];
}

export interface CognitionState {
  cognition_state_id: string;
  mission: string;
  objective: string;
  stable_constraints: string[];
  governance_principles: string[];
  unresolved_tensions: string[];
  rejected_directions: string[];
  accepted_decisions: string[];
  provisional_assumptions: string[];
  operational_risks: string[];
  continuity_anchors: string[];
  reconstruction_prompt: string;
  model_transfer_notes: Partial<Record<TargetModel | string, string>>;
  user_preferences?: Record<string, unknown>;
  next_actions?: string[];
}

export interface Capsule {
  capsule_id: string;
  parent_workflow_id?: string;
  capsule_text: string;
  capsule_json: Record<string, unknown>;
  compression_level?: "light" | "standard" | "dense";
  preserved_constraints: string[];
  lost_context_notes: string[];
  reconstruction_quality_estimate?: number;
  target_model?: TargetModel | string;
  created_at: string;
}

export interface DiagnosticState {
  diagnostic_id: string;
  workflow_id?: string;
  platform: string;
  timestamp: string;
  raw_input_length?: number;
  compressed_length?: number;
  compact_percent?: number;
  constraint_preservation_percent?: number;
  risk_percent?: number;
  warnings: string[];
  errors: string[];
  observer_state?: Record<string, unknown>;
  toolbar_state?: Record<string, unknown>;
  save_status?: string;
  export_status?: string;
}
