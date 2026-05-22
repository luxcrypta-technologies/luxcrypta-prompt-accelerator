import type { ModeName } from "./modes";

export interface PortableCapsuleMetadata {
  source_platform?: string;
  detected_model?: string;
  workflow_identity?: string;
  governance_state?: Record<string, unknown>;
  governance_principles?: string[];
  invariants?: string[];
  continuity_safeguards?: string[];
  quarantine_log?: string[];
  deferred_items?: string[];
  conditional_admissions?: string[];
  mutation_targets?: unknown[];
  rejected_directions?: string[];
  continuity_anchors?: string[];
  reconstruction_instructions?: string;
  model_transfer_notes?: Record<string, unknown>;
  diagnostic_metadata?: Record<string, unknown>;
}

export interface CarryForwardCapsule {
  capsule_version: 1;
  id: string;
  capsule_id?: string;
  version?: 1;
  title: string;
  objective: string;
  workflow_identity?: string;
  source_platform?: string;
  detected_model?: string;
  active_objective?: string;
  constraints: string[];
  stable_constraints?: string[];
  decisions: string[];
  accepted_decisions?: string[];
  open_questions: string[];
  unresolved_issues?: string[];
  governance_state?: Record<string, unknown>;
  governance_principles?: string[];
  invariants?: string[];
  continuity_safeguards?: string[];
  quarantine_log?: string[];
  deferred_items?: string[];
  conditional_admissions?: string[];
  mutation_targets?: unknown[];
  rejected_directions?: string[];
  continuity_anchors?: string[];
  reconstruction_instructions?: string;
  model_transfer_notes?: Record<string, unknown>;
  diagnostic_metadata?: Record<string, unknown>;
  preferred_mode?: ModeName;
  notes?: string;
  sourceSurface?: string;
  created_at: string;
  updated_at?: string;
}
