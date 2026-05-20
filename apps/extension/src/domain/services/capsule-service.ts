import { createCapsuleFromSnapshot } from "@/core/capsules";
import { CapsuleStore } from "@/storage/capsule-store";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { CapsuleSaveInput } from "@/types/messages";
import type { PlatformStorage } from "@/types/platform";
import type { ConversationSnapshot } from "@/types/surfaces";
import { createDatedId } from "@/utils/ids";
import { nowIso } from "@/utils/time";

export class CapsuleService {
  private readonly store: CapsuleStore;

  constructor(storage: PlatformStorage) {
    this.store = new CapsuleStore(storage);
  }

  list(): Promise<CarryForwardCapsule[]> {
    return this.store.list();
  }

  async create(snapshot: ConversationSnapshot | undefined, sourceSurface?: string): Promise<CarryForwardCapsule> {
    const capsule = createCapsuleFromSnapshot(snapshot, sourceSurface);
    const versioned = { ...capsule, version: capsule.version ?? 1, capsule_id: capsule.capsule_id ?? capsule.id };
    await this.store.save(versioned);
    const persisted = await this.store.get(versioned.id);
    if (!persisted) {
      throw new Error("Capsule storage write could not be verified.");
    }
    return persisted;
  }

  async createFromReview(input: CapsuleSaveInput): Promise<CarryForwardCapsule> {
    const timestamp = nowIso();
    const id = createDatedId("capsule", `${input.title}:${input.objective}`, timestamp);
    const capsule: CarryForwardCapsule = {
      capsule_version: 1,
      version: 1,
      ...input,
      id,
      capsule_id: id,
      created_at: timestamp,
      updated_at: timestamp
    };
    await this.store.save(capsule);
    const persisted = await this.store.get(capsule.id);
    if (!persisted) {
      throw new Error("Capsule storage write could not be verified.");
    }
    return persisted;
  }

  async save(capsule: CarryForwardCapsule): Promise<CarryForwardCapsule> {
    const versioned = {
      ...capsule,
      version: capsule.version ?? 1,
      capsule_id: capsule.capsule_id ?? capsule.id,
      updated_at: nowIso()
    } satisfies CarryForwardCapsule;
    await this.store.save(versioned);
    const persisted = await this.store.get(versioned.id);
    if (!persisted) {
      throw new Error("Capsule storage write could not be verified.");
    }
    return persisted;
  }
}
