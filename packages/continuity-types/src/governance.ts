import type { CarryForwardCapsule } from "./capsules";
import type { ModeName } from "./modes";
import type { TargetModel } from "./models";
import type { AdversarialGovernanceState, MutationTarget, TransformRequest, TransformResult } from "./prompts";
import type { ConversationSnapshot } from "./surfaces";

export interface SessionStableCore {
  objective: string;
  hardConstraints: string[];
  acceptedDecisions: string[];
  outputContract?: string;
  preferredMode?: ModeName;
  preferredTargetModel?: TargetModel;
  lastUpdatedAt: string;
}

export interface SessionNoveltyItem {
  id: string;
  text: string;
  kind:
    | "new_objective"
    | "new_constraint"
    | "changed_constraint"
    | "new_decision"
    | "framing_shift"
    | "output_shift"
    | "other";
  confidence: number;
  source: "draft" | "transform" | "capsule" | "manual";
  createdAt: string;
  accepted?: boolean;
  lastSeenAt?: string;
  seenCount?: number;
  promotable?: boolean;
  diagnosticNote?: string;
}

export interface SessionOpennessState {
  openQuestions: string[];
  uncertaintyNotes: string[];
  optionalBranches: string[];
  preservedCreativeSpace: boolean;
  lastUpdatedAt: string;
}

export interface SessionMonitors {
  // Canonical six-component continuity health vector (Stage 1).
  // Existing field names retained for the 5 original consumers; the mapping to
  // the doctrine's (chi, delta, rho, mu, nu, omega) is noted per field.
  continuityScore: number; // chi  — composite continuity health (anchor)
  driftScore: number; // delta — drift vs session baseline W0
  noveltyLoad: number; // nu   — novelty load (excludes stable/ARC; D7 fix)
  opennessScore: number; // omega — openness / GAP pressure
  compressionDensity: number; // retained: compression density
  replayFidelity?: number; // rho  — replay re-derivation similarity (0-100)
  mutationStability?: number; // mu   — admitted-clean / total mutations (0-100)
  sessionHealth: "healthy" | "watch" | "unstable";
}

export interface SessionDiagnostics {
  stableCoreSummary: string[];
  noveltySummary: string[];
  opennessSummary: string[];
  warnings: string[];
  actionsSuggested: string[];
  generatedAt: string;
  snapshot_scope?: {
    turns_captured: number;
    capture_scope: "full" | "partial" | "empty";
    coverage_confidence: "high" | "medium" | "low";
    role_attribution: "dom_markers" | "positional_fallback";
  } | null;
  awg_distribution?: { arc: number; wedge: number; gap: number; heldOut: number };
  legality?: {
    objective_score: number;
    legal: boolean;
    violations: string[];
    monotonic: boolean;
  };
  cap_overflow?: { constraints: number; decisions: number; total: number };
  placement_mismatches?: number;
}

export interface SessionGovernanceState {
  id: string;
  conversationKey?: string;
  title?: string;
  stableCore: SessionStableCore;
  noveltyLane: SessionNoveltyItem[];
  opennessLane: SessionOpennessState;
  governancePrinciples?: string[];
  invariants?: string[];
  continuitySafeguards?: string[];
  rejectedDirections?: string[];
  quarantineLog?: string[];
  deferredItems?: string[];
  mutationTargets?: MutationTarget[];
  adversarialGovernance?: AdversarialGovernanceState;
  monitors: SessionMonitors;
  diagnostics: SessionDiagnostics;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUpdateInput {
  previousState?: SessionGovernanceState | null;
  conversationKey?: string | null;
  snapshotScope?: {
    turns_captured: number;
    capture_scope: "full" | "partial" | "empty";
    coverage_confidence: "high" | "medium" | "low";
    role_attribution: "dom_markers" | "positional_fallback";
  } | null;
  transformRequest?: TransformRequest;
  transformResult?: TransformResult;
  conversationSnapshot?: ConversationSnapshot | null;
  capsule?: CarryForwardCapsule | null;
  sourceSurface?: string;
  preserveOpenQuestions?: boolean;
  conservativeStableCoreUpdates?: boolean;
}

export interface SessionUpdateResult {
  state: SessionGovernanceState;
  carryForwardCandidate: CarryForwardCapsule;
}
