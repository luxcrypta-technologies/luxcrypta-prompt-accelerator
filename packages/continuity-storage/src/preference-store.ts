import { DEFAULT_CONTINUITY_PREFERENCES } from "@luxcrypta/continuity-types/preferences-defaults";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { UserPreferences } from "@luxcrypta/continuity-types/preferences";
import { PREFERENCE_KEY } from "./keys";

export class PreferenceStore {
  constructor(private readonly storage: ContinuityStorage) {}

  async get(): Promise<UserPreferences> {
    const saved = await this.storage.get<UserPreferences>(PREFERENCE_KEY);
    return { ...DEFAULT_CONTINUITY_PREFERENCES, ...saved, localOnlyMode: true };
  }

  async update(next: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.get();
    const updated: UserPreferences = { ...current, ...next, localOnlyMode: true };
    await this.storage.set(PREFERENCE_KEY, updated);
    return updated;
  }
}
