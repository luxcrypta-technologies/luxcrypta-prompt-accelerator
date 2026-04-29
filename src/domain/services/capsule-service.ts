import { createCapsuleFromSnapshot } from "@/core/capsules";
import { CapsuleStore } from "@/storage/capsule-store";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { PlatformStorage } from "@/types/platform";
import type { ConversationSnapshot } from "@/types/surfaces";

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
    await this.store.save(capsule);
    return capsule;
  }

  async save(capsule: CarryForwardCapsule): Promise<CarryForwardCapsule> {
    await this.store.save(capsule);
    return capsule;
  }
}
