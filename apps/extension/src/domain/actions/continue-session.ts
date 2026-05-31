import { CapsuleService } from "@/domain/services/capsule-service";
import { SessionGovernanceService } from "@/domain/services/session-governance-service";
import { CapsuleStore } from "@/storage/capsule-store";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { PlatformStorage } from "@/types/platform";
import type { ConversationSnapshot } from "@/types/surfaces";

/**
 * Build a carry-forward capsule for the CURRENT conversation (crossover fix +
 * D0a). Resolves session state scoped to conversationKey — never the global
 * slot — so the capsule reflects this conversation, not a stale prior one.
 * When no accumulated session state exists for this conversation, builds from
 * the freshly-read live snapshot rather than silently reusing another session.
 */
export async function executeContinueSession(
  input: {
    snapshot?: ConversationSnapshot;
    sourceSurface?: string;
    conversationKey?: string | null;
  },
  deps: { storage: PlatformStorage }
): Promise<CarryForwardCapsule> {
  const governance = new SessionGovernanceService(deps.storage);
  const currentState = await governance.getCurrent(input.conversationKey);
  if (currentState) {
    const capsule = {
      ...governance.createCarryForward(currentState),
      sourceSurface: input.sourceSurface,
      conversationKey: input.conversationKey ?? currentState.conversationKey ?? undefined
    };
    await new CapsuleStore(deps.storage).save(capsule);
    return capsule;
  }

  return new CapsuleService(deps.storage).create(input.snapshot, input.sourceSurface);
}
