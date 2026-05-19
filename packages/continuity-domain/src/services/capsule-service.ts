import { createCapsuleFromSnapshot } from "@luxcrypta/continuity-core/capsules";
import { CapsuleStore } from "@luxcrypta/continuity-storage/capsule-store";
import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { ConversationSnapshot } from "@luxcrypta/continuity-types/surfaces";

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
    await this.store.save(capsule);
    return capsule;
  }

  async save(capsule: CarryForwardCapsule): Promise<CarryForwardCapsule> {
    await this.store.save(capsule);
    return capsule;
  }
}
