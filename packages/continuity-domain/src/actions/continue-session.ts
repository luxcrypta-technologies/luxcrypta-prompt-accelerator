import { CapsuleService } from "@luxcrypta/continuity-domain/services/capsule-service";
import { SessionGovernanceService } from "@luxcrypta/continuity-domain/services/session-governance-service";
import { CapsuleStore } from "@luxcrypta/continuity-storage/capsule-store";
import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { ConversationSnapshot } from "@luxcrypta/continuity-types/surfaces";

export async function executeContinueSession(
  input: { snapshot?: ConversationSnapshot; sourceSurface?: string },
  deps: { storage: ContinuityStorage }
): Promise<CarryForwardCapsule> {
  const governance = new SessionGovernanceService(deps.storage);
  const currentState = await governance.getCurrent();
  if (currentState) {
    const capsule = {
      ...governance.createCarryForward(currentState),
      sourceSurface: input.sourceSurface
    };
    await new CapsuleStore(deps.storage).save(capsule);
    return capsule;
  }

  return new CapsuleService(deps.storage).create(input.snapshot, input.sourceSurface);
}
