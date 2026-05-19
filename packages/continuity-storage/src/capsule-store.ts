import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import { capsuleKey, STORAGE_PREFIXES } from "./keys";

export class CapsuleStore {
  constructor(private readonly storage: ContinuityStorage) {}

  get(id: string): Promise<CarryForwardCapsule | null> {
    return this.storage.get<CarryForwardCapsule>(capsuleKey(id));
  }

  async list(): Promise<CarryForwardCapsule[]> {
    const items = await this.storage.list<CarryForwardCapsule>(STORAGE_PREFIXES.capsule);
    return [...items].sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  save(capsule: CarryForwardCapsule): Promise<void> {
    return this.storage.set(capsuleKey(capsule.id), capsule);
  }

  remove(id: string): Promise<void> {
    return this.storage.remove(capsuleKey(id));
  }
}
