export type {
  SessionDiagnostics,
  SessionGovernanceState,
  SessionMonitors,
  SessionNoveltyItem,
  SessionOpennessState,
  SessionStableCore,
  SessionUpdateInput,
  SessionUpdateResult
} from "@luxcrypta/continuity-types/governance";

export type SessionCandidateKind =
  | "objective"
  | "constraint"
  | "decision"
  | "open_question"
  | "uncertainty"
  | "optional_branch"
  | "output_contract";

export interface SessionCandidate {
  text: string;
  kind: SessionCandidateKind;
  confidence: number;
  source: "draft" | "transform" | "capsule" | "manual";
}

export interface SessionPartition {
  stableCandidates: SessionCandidate[];
  noveltyCandidates: SessionCandidate[];
  opennessCandidates: SessionCandidate[];
}
