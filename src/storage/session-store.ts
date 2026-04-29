import type { PlatformStorage } from "@/types/platform";
import type { SessionGovernanceState } from "@/types/governance";
import { CURRENT_SESSION_KEY, sessionKey, STORAGE_PREFIXES } from "./keys";

export class SessionStore {
  constructor(private readonly storage: PlatformStorage) {}

  getCurrent(): Promise<SessionGovernanceState | null> {
    return this.storage.get<SessionGovernanceState>(CURRENT_SESSION_KEY);
  }

  get(id: string): Promise<SessionGovernanceState | null> {
    return this.storage.get<SessionGovernanceState>(sessionKey(id));
  }

  async list(): Promise<SessionGovernanceState[]> {
    const items = await this.storage.list<SessionGovernanceState>(STORAGE_PREFIXES.session);
    const byId = new Map(items.map((item) => [item.id, item]));
    return [...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async save(state: SessionGovernanceState): Promise<void> {
    await this.storage.set(sessionKey(state.id), state);
    await this.storage.set(CURRENT_SESSION_KEY, state);
  }

  async resetCurrent(): Promise<void> {
    await this.storage.remove(CURRENT_SESSION_KEY);
  }

  remove(id: string): Promise<void> {
    return this.storage.remove(sessionKey(id));
  }
}
