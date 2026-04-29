import { PreferenceStore } from "@/storage/preference-store";
import type { PlatformStorage } from "@/types/platform";
import type { UserPreferences } from "@/types/preferences";

export class PreferenceService {
  private readonly store: PreferenceStore;

  constructor(storage: PlatformStorage) {
    this.store = new PreferenceStore(storage);
  }

  get(): Promise<UserPreferences> {
    return this.store.get();
  }

  update(patch: Partial<UserPreferences>): Promise<UserPreferences> {
    return this.store.update(patch);
  }
}
