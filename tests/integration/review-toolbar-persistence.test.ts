import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "@/background/message-router";
import { CapsuleStore } from "@/storage/capsule-store";
import { WorkflowStore } from "@/storage/workflow-store";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { BackgroundMessage } from "@/types/messages";
import type { PlatformAPI, PlatformStorage } from "@/types/platform";
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

function platformWithStorage(storage: PlatformStorage): PlatformAPI {
  return {
    getPlatform: () => ({
      name: "chromium",
      capabilities: {
        supportsActionPopup: true,
        supportsBrowserNamespace: false,
        supportsSidePanel: true,
        supportsStorageLocal: true
      }
    }),
    storage,
    messaging: {
      sendMessage: vi.fn(),
      onMessage: vi.fn()
    },
    tabs: {
      getActiveTabId: vi.fn().mockResolvedValue(1),
      openTab: vi.fn().mockResolvedValue(undefined),
      sendToActiveTab: vi.fn(),
      sendToTab: vi.fn().mockResolvedValue({ applied: true, text: "Applied draft", surfaceId: "chatgpt" })
    },
    reviewSurface: {
      getPreferredSurface: () => "review_tab",
      openReviewSurface: vi.fn().mockResolvedValue(undefined)
    }
  };
}

describe("review toolbar persistence routes", () => {
  it("stores workflow and capsule artifacts created from the review window", async () => {
    const storage = new MemoryStorage();
    const route = createMessageRouter(platformWithStorage(storage));

    const workflow = (await route({
      type: "workflow:save",
      payload: {
        workflow: {
          title: "Prompt Accelerator Marketing Strategy",
          objective: "Launch with premium continuity positioning.",
          mode: "precision",
          constraints: ["Do not reintroduce Compress or Focus buttons."],
          outputPreferences: ["Accepted decision: keep toolbar actions visible."],
          carryForwardContext: "Continuity Review\n\nActive Objective\nLaunch with premium continuity positioning.",
          targetModel: "chatgpt",
          tags: ["continuity-review"]
        }
      }
    } satisfies BackgroundMessage)) as Workflow;

    const capsule = (await route({
      type: "capsule:save",
      payload: {
        capsule: {
          title: "Prompt Accelerator Marketing Strategy Capsule",
          objective: "Launch with premium continuity positioning.",
          constraints: ["Do not reintroduce Compress or Focus buttons."],
          decisions: ["Keep toolbar actions visible."],
          open_questions: ["Where should saved artifacts appear later?"],
          preferred_mode: "precision",
          notes: "Saved from Continuity Review.",
          sourceSurface: "chatgpt"
        }
      }
    } satisfies BackgroundMessage)) as CarryForwardCapsule;

    await expect(new WorkflowStore(storage).get(workflow.id)).resolves.toEqual(workflow);
    await expect(new CapsuleStore(storage).get(capsule.id)).resolves.toEqual(capsule);
    await expect(new WorkflowStore(storage).list()).resolves.toHaveLength(1);
    await expect(new CapsuleStore(storage).list()).resolves.toHaveLength(1);
  });
});
