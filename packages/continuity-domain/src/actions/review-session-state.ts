import { SessionGovernanceService } from "@luxcrypta/continuity-domain/services/session-governance-service";
import type { SessionDiagnostics, SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";

export function executeReviewSessionState(deps: { storage: ContinuityStorage }): Promise<SessionGovernanceState | null> {
  return new SessionGovernanceService(deps.storage).getCurrent();
}

export function executeGetDiagnostics(deps: { storage: ContinuityStorage }): Promise<SessionDiagnostics | null> {
  return new SessionGovernanceService(deps.storage).getDiagnostics();
}
