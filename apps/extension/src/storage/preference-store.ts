import { DEFAULT_PREFERENCES } from "@/app/config";
import type { PlatformStorage } from "@/types/platform";
import type { UserPreferences } from "@/types/preferences";
import { PREFERENCE_KEY } from "./keys";

export class PreferenceStore {
  constructor(private readonly storage: PlatformStorage) {}

  async get(): Promise<UserPreferences> {
    const saved = await this.storage.get<UserPreferences>(PREFERENCE_KEY);
    return { ...DEFAULT_PREFERENCES, ...saved, localOnlyMode: true };
  }

  async update(next: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.get();
    const updated: UserPreferences = { ...current, ...next, localOnlyMode: true };
    await this.storage.set(PREFERENCE_KEY, updated);
    return updated;
  }
}
