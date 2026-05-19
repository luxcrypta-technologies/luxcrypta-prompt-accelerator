import { PreferenceStore } from "@luxcrypta/continuity-storage/preference-store";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { UserPreferences } from "@luxcrypta/continuity-types/preferences";

export class PreferenceService {
  private readonly store: PreferenceStore;

  constructor(storage: ContinuityStorage) {
    this.store = new PreferenceStore(storage);
  }

  get(): Promise<UserPreferences> {
    return this.store.get();
  }

  update(patch: Partial<UserPreferences>): Promise<UserPreferences> {
    return this.store.update(patch);
  }
}
