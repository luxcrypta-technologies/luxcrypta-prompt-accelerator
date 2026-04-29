import { describe, expect, it } from "vitest";
import { WorkflowStore } from "@/storage/workflow-store";
import type { PlatformStorage } from "@/types/platform";
import type { Workflow } from "@/types/workflows";

class MemoryStorage implements PlatformStorage {
  private readonly values = new Map<string, unknown>();
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

describe("stores", () => {
  it("saves and lists workflows through platform storage", async () => {
    const store = new WorkflowStore(new MemoryStorage());
    const workflow: Workflow = {
      id: "workflow_1",
      title: "Plan",
      objective: "Make a plan",
      mode: "focus",
      constraints: [],
      outputPreferences: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    await store.save(workflow);
    await expect(store.get(workflow.id)).resolves.toEqual(workflow);
    await expect(store.list()).resolves.toEqual([workflow]);
  });
});
