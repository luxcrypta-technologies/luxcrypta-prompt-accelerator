import { SessionGovernanceService } from "@/domain/services/session-governance-service";
import type { SessionDiagnostics, SessionGovernanceState } from "@/types/governance";
import type { PlatformStorage } from "@/types/platform";

export function executeReviewSessionState(deps: { storage: PlatformStorage }): Promise<SessionGovernanceState | null> {
  return new SessionGovernanceService(deps.storage).getCurrent();
}

export function executeGetDiagnostics(deps: { storage: PlatformStorage }): Promise<SessionDiagnostics | null> {
  return new SessionGovernanceService(deps.storage).getDiagnostics();
}
