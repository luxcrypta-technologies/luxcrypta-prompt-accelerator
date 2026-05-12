import { SessionGovernanceService } from "@/domain/services/session-governance-service";
import type { SessionGovernanceState } from "@/types/governance";
import type { PlatformStorage } from "@/types/platform";

export function executePromoteNovelty(
  input: { noveltyIds: string[] },
  deps: { storage: PlatformStorage }
): Promise<SessionGovernanceState | null> {
  return new SessionGovernanceService(deps.storage).promoteNovelty(input.noveltyIds);
}
