import { CapsuleService } from "@/domain/services/capsule-service";
import { SessionGovernanceService } from "@/domain/services/session-governance-service";
import { CapsuleStore } from "@/storage/capsule-store";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { PlatformStorage } from "@/types/platform";
import type { ConversationSnapshot } from "@/types/surfaces";

export async function executeContinueSession(
  input: { snapshot?: ConversationSnapshot; sourceSurface?: string },
  deps: { storage: PlatformStorage }
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
