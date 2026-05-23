import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "@/background/message-router";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import type { PlatformAPI, PlatformStorage } from "@/types/platform";

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

function platform(
  openReviewSurface = vi.fn().mockResolvedValue(undefined),
  storage: PlatformStorage = new MemoryStorage()
): PlatformAPI {
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
      getActiveTabId: vi.fn().mockResolvedValue(12),
      openTab: vi.fn().mockResolvedValue(undefined),
      sendToActiveTab: vi.fn(),
      sendToTab: vi.fn()
    },
    reviewSurface: {
      getPreferredSurface: () => "review_tab",
      openReviewSurface
    }
  };
}

function result() {
  return transformPrompt({
    sourceText: "Objective: test visible review open. Invariant: no false success.",
    sourceSurface: "perplexity",
    providerHealth: {
      provider: "perplexity",
      surface_detected: true,
      input_detected: true,
      toolbar_mounted: true,
      draft_read_success: true,
      writeback_success: false,
      review_open_attempted: true,
      review_open_status: "pending",
      click_detected: true,
      navigation_attempted: true,
      visible_to_user: false,
      duplicate_guard_active: true,
      runtime_errors: []
    }
  });
}

describe("Prompt Review open truth model", () => {
  it("does not record success until the review app reports visible rendered content", async () => {
    const route = createMessageRouter(platform());
    const opened = (await route({
      type: "review:open",
      payload: { result: result() }
    })) as { reviewId: string; visibleToUser?: boolean; openStatus?: string };

    expect(opened.visibleToUser).toBe(false);
    expect(opened.openStatus).toBe("pending");

    const pending = (await route({
      type: "review:status",
      payload: { reviewId: opened.reviewId }
    })) as { visibleToUser?: boolean; openStatus?: string };

    expect(pending.visibleToUser).toBe(false);
    expect(pending.openStatus).toBe("pending");

    const rendered = (await route({
      type: "review:rendered",
      payload: { reviewId: opened.reviewId }
    })) as { visibleToUser?: boolean; openStatus?: string };

    expect(rendered.visibleToUser).toBe(true);
    expect(rendered.openStatus).toBe("success");
  });

  it("records the failed observable-open stage when surface creation throws", async () => {
    const route = createMessageRouter(
      platform(vi.fn().mockRejectedValue(new Error("tab creation blocked")))
    );

    await expect(
      route({
        type: "review:open",
        payload: { result: result() }
      })
    ).rejects.toThrow("tab creation blocked");

    const latest = (await route({
      type: "review:get",
      payload: {}
    })) as { result: ReturnType<typeof result> };

    expect(latest.result.continuityReview.diagnostics.providerHealth).toMatchObject({
      review_open_status: "failed",
      visible_to_user: false,
      failure_stage: "surface_created",
      failure_reason: "tab creation blocked"
    });
  });

  it("recovers review state from storage after the background worker loses memory", async () => {
    const storage = new MemoryStorage();
    const firstRoute = createMessageRouter(platform(undefined, storage));
    const opened = (await firstRoute({
      type: "review:open",
      payload: { result: result() }
    })) as { reviewId: string };

    const restartedRoute = createMessageRouter(platform(undefined, storage));
    const recovered = (await restartedRoute({
      type: "review:get",
      payload: { reviewId: opened.reviewId }
    })) as { id?: string; result?: ReturnType<typeof result> } | null;

    expect(recovered?.id).toBe(opened.reviewId);
    expect(recovered?.result?.continuityReview.diagnostics.providerHealth).toMatchObject({
      review_open_status: "pending",
      surface_created: true,
      visible_to_user: false
    });
  });

  it("persists visible review edits before copy/export can read them later", async () => {
    const storage = new MemoryStorage();
    const route = createMessageRouter(platform(undefined, storage));
    const opened = (await route({
      type: "review:open",
      payload: { result: result() }
    })) as { reviewId: string };
    const updatedResult = {
      ...result(),
      transformedText: "Objective: persisted edited review payload."
    };

    await route({
      type: "review:update",
      payload: { reviewId: opened.reviewId, result: updatedResult }
    });

    const restartedRoute = createMessageRouter(platform(undefined, storage));
    const recovered = (await restartedRoute({
      type: "review:get",
      payload: { reviewId: opened.reviewId }
    })) as { result?: ReturnType<typeof result> } | null;

    expect(recovered?.result?.transformedText).toBe("Objective: persisted edited review payload.");
  });
});
