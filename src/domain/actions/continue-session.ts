import { CapsuleService } from "@/domain/services/capsule-service";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { PlatformStorage } from "@/types/platform";
import type { ConversationSnapshot } from "@/types/surfaces";

export function executeContinueSession(
  input: { snapshot?: ConversationSnapshot; sourceSurface?: string },
  deps: { storage: PlatformStorage }
): Promise<CarryForwardCapsule> {
  return new CapsuleService(deps.storage).create(input.snapshot, input.sourceSurface);
}
