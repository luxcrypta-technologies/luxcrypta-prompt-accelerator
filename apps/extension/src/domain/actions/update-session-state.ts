import { SessionGovernanceService } from "@/domain/services/session-governance-service";
import type { SessionUpdateInput, SessionUpdateResult } from "@/types/governance";
import type { PlatformStorage } from "@/types/platform";

export function executeUpdateSessionState(
  input: SessionUpdateInput,
  deps: { storage: PlatformStorage }
): Promise<SessionUpdateResult | null> {
  return new SessionGovernanceService(deps.storage).update(input);
}
