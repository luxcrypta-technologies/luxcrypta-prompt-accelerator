import { describe, expect, it } from "vitest";
import { SessionGovernanceService } from "@/domain/services/session-governance-service";
import { STORAGE_PREFIXES } from "@/storage/keys";
import type { PlatformStorage } from "@/types/platform";

// F1: a temporary chat is resolved to a non-persistable conversation key
// (persistable:false). The session service must NOT write durable session
// state for it — otherwise the temp chat's state lands in storage and bleeds
// into later conversations (the live "ChatGPT temp shows Claude state" capsule).
class MemoryStorage implements PlatformStorage {
  readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
  async list<T>(prefix: string): Promise<T[]> {
    return Array.from(this.values.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value as T);
  }
}

function sessionKeysIn(storage: MemoryStorage): string[] {
  return Array.from(storage.values.keys()).filter((k) => k.startsWith(STORAGE_PREFIXES.session));
}

describe("F1: temporary chats never persist durable session state", () => {
  it("does NOT write any session slot when persistable is false", async () => {
    const storage = new MemoryStorage();
    const service = new SessionGovernanceService(storage);

    const result = await service.update({
      transformRequest: { sourceText: "World Cup matches remaining today", mode: "precision" },
      conversationKey: "chatgpt:temp-abc123",
      persistable: false
    } as never);

    // The transform still returns a usable result for the live turn...
    expect(result).not.toBeNull();
    // ...but NOTHING durable is written for a temporary chat.
    expect(sessionKeysIn(storage)).toEqual([]);
  });

  it("DOES persist a normal (persistable) conversation", async () => {
    const storage = new MemoryStorage();
    const service = new SessionGovernanceService(storage);

    await service.update({
      transformRequest: { sourceText: "Design a microgrid for Cedar Hollow", mode: "precision" },
      conversationKey: "claude:real-thread-1",
      persistable: true
    } as never);

    expect(sessionKeysIn(storage).length).toBeGreaterThan(0);
  });

  it("a temp chat cannot surface a prior persisted session as previousState", async () => {
    const storage = new MemoryStorage();
    const service = new SessionGovernanceService(storage);

    // A real Claude conversation persists durable state.
    await service.update({
      transformRequest: { sourceText: "EchoGate governs the lunar rover character", mode: "precision" },
      conversationKey: "claude:real-thread-1",
      persistable: true
    } as never);

    // Now a temporary ChatGPT chat runs. It must not adopt the Claude state.
    const temp = await service.update({
      transformRequest: { sourceText: "World Cup matches remaining today", mode: "precision" },
      conversationKey: "chatgpt:temp-xyz",
      persistable: false
    } as never);

    const core = [
      ...(temp?.state.stableCore.hardConstraints ?? []),
      ...(temp?.state.stableCore.acceptedDecisions ?? []),
      temp?.state.stableCore.objective ?? ""
    ]
      .join(" ")
      .toLowerCase();
    expect(core).not.toContain("echogate");
    expect(core).not.toContain("lunar");
  });
});
