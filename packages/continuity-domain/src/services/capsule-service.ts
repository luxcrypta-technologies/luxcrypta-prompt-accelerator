import { createCapsuleFromSnapshot } from "@luxcrypta/continuity-core/capsules";
import { CapsuleStore } from "@luxcrypta/continuity-storage/capsule-store";
import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { ConversationSnapshot } from "@luxcrypta/continuity-types/surfaces";
import { nowIso } from "@luxcrypta/continuity-types/utils/time";

export class CapsuleService {
  private readonly store: CapsuleStore;

  constructor(storage: ContinuityStorage) {
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
