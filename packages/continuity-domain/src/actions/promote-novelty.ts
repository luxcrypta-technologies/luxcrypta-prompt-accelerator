import { SessionGovernanceService } from "@luxcrypta/continuity-domain/services/session-governance-service";
import type { SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";

export function executePromoteNovelty(
  input: { noveltyIds: string[] },
  deps: { storage: ContinuityStorage }
): Promise<SessionGovernanceState | null> {
  return new SessionGovernanceService(deps.storage).promoteNovelty(input.noveltyIds);
}
