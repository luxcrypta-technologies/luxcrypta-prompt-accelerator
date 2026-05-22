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
  continuityScore: number;
  driftScore: number;
  noveltyLoad: number;
  opennessScore: number;
  compressionDensity: number;
  sessionHealth: "healthy" | "watch" | "unstable";
}

export interface SessionDiagnostics {
  stableCoreSummary: string[];
  noveltySummary: string[];
  opennessSummary: string[];
  warnings: string[];
  actionsSuggested: string[];
  generatedAt: string;
}

export interface SessionGovernanceState {
  id: string;
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
