import { SessionGovernanceService } from "@luxcrypta/continuity-domain/services/session-governance-service";
import type { SessionUpdateInput, SessionUpdateResult } from "@luxcrypta/continuity-types/governance";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";

export function executeUpdateSessionState(
  input: SessionUpdateInput,
  deps: { storage: ContinuityStorage }
): Promise<SessionUpdateResult | null> {
  return new SessionGovernanceService(deps.storage).update(input);
}
