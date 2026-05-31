import type { PlatformStorage } from "@/types/platform";
import type { SessionGovernanceState } from "@/types/governance";
import { CURRENT_SESSION_KEY, currentSessionKey, sessionKey, STORAGE_PREFIXES } from "./keys";

/**
 * Conversation-scoped session store (Stage 0, defect D0a-1).
 *
 * Previously `getCurrent()` read a single global `session:current` slot and
 * `save()` always overwrote it, so state from one conversation (even on another
 * provider, even a week old) bled into every other conversation. Now "current"
 * is resolved per conversation: `session:current:<provider>:<conversationId>`.
 *
 * The legacy global `CURRENT_SESSION_KEY` is still written/read ONLY as a
 * fallback for the pre-first-message window where no conversation id exists yet
 * (the agreed in-memory-until-id-appears behavior is layered above this in the
 * router; this fallback keeps a single-tab session coherent before commit).
 */
export class SessionStore {
  constructor(private readonly storage: PlatformStorage) {}

  async getCurrent(conversationKey?: string | null): Promise<SessionGovernanceState | null> {
    if (conversationKey) {
      const scoped = await this.storage.get<SessionGovernanceState>(
        currentSessionKey(conversationKey)
      );
      if (scoped) return scoped;
      // No scoped state yet for this conversation -> start clean. Do NOT fall
      // back to the global slot here; that is exactly the bleed we removed.
      return null;
    }
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
    if (state.conversationKey) {
      await this.storage.set(currentSessionKey(state.conversationKey), state);
    } else {
      await this.storage.set(CURRENT_SESSION_KEY, state);
    }
  }

  async resetCurrent(conversationKey?: string | null): Promise<void> {
    if (conversationKey) {
      await this.storage.remove(currentSessionKey(conversationKey));
      return;
    }
    await this.storage.remove(CURRENT_SESSION_KEY);
  }

  remove(id: string): Promise<void> {
    return this.storage.remove(sessionKey(id));
  }
}
