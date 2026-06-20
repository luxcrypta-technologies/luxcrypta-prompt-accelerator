import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "@/background/message-router";
import { CURRENT_SESSION_KEY } from "@/storage/keys";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import type { PlatformAPI, PlatformStorage } from "@/types/platform";
import type { SessionGovernanceState } from "@/types/governance";

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
      review_open_status: "requested",
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
    expect(opened.openStatus).toBe("surface_created");
    expect(opened.openStatus).not.toBe("open_success");

    const pending = (await route({
      type: "review:status",
      payload: { reviewId: opened.reviewId }
    })) as { visibleToUser?: boolean; openStatus?: string; providerHealth?: Record<string, unknown> };

    expect(pending.visibleToUser).toBe(false);
    expect(pending.openStatus).toBe("surface_created");
    expect(pending.providerHealth).toMatchObject({
      route_key: `12:${opened.reviewId}`,
      persisted_session_state_present: false,
      session_state_source: "built_fresh_in_session",
      build_provenance: expect.objectContaining({
        extension_version: "2.5.11",
        build_timestamp: expect.any(String),
        commit_sha: expect.any(String),
        environment_tag: expect.any(String)
      })
    });

    const rendered = (await route({
      type: "review:rendered",
      payload: { reviewId: opened.reviewId }
    })) as {
      visibleToUser?: boolean;
      openStatus?: string;
      providerHealth?: { review_open_events?: string[] };
      result?: ReturnType<typeof result>;
    };

    expect(rendered.visibleToUser).toBe(true);
    expect(rendered.openStatus).toBe("open_success");
    expect(rendered.result?.continuityReview.diagnostics.export_readiness_decision).toBe(
      "SAFE_FOR_HANDOFF"
    );
    expect(rendered.result?.continuityReview.diagnostics.runtime_snapshot).toMatchObject({
      route_key: `12:${opened.reviewId}`,
      persisted_session_state_present: false,
      session_state_source: "built_fresh_in_session"
    });
    expect(rendered.result?.continuityReview.diagnostics.readiness_blockers ?? []).not.toContain(
      "review-open was not visibly confirmed"
    );
    expect(rendered.providerHealth?.review_open_events).toEqual(
      expect.arrayContaining([
        "review_first_content_rendered",
        "review_visible_acknowledged",
        "review_state_persisted",
        "review_open_success"
      ])
    );
  });

  it("opens the review surface exactly once when pre-opened within the gesture", async () => {
    const openSpy = vi.fn().mockResolvedValue(undefined);
    const route = createMessageRouter(platform(openSpy));
    await route({ type: "review:preopen", payload: { sourceSurface: "gemini" } });
    await route({ type: "review:open", payload: { result: result(), preopened: true } });
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it("opens twice only when the preopened flag is absent (guards the regression)", async () => {
    const openSpy = vi.fn().mockResolvedValue(undefined);
    const route = createMessageRouter(platform(openSpy));
    await route({ type: "review:preopen", payload: { sourceSurface: "gemini" } });
    await route({ type: "review:open", payload: { result: result() } });
    // documents that the flag is what prevents the duplicate; with it set (above)
    // the surface opens once, without it the legacy double-open occurs.
    expect(openSpy).toHaveBeenCalledTimes(2);
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
      review_open_status: "open_failed",
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
      review_open_status: "surface_created",
      surface_created: true,
      visible_to_user: false
    });
  });

  it("marks persisted local session state when it is present at review open", async () => {
    const storage = new MemoryStorage();
    const session: SessionGovernanceState = {
      id: "session_existing",
      title: "Existing session",
      stableCore: {
        objective: "Preserve persisted session provenance diagnostics.",
        hardConstraints: [],
        acceptedDecisions: [],
        lastUpdatedAt: "2026-05-20T00:00:00.000Z"
      },
      noveltyLane: [],
      opennessLane: {
        openQuestions: [],
        uncertaintyNotes: [],
        optionalBranches: [],
        preservedCreativeSpace: false,
        lastUpdatedAt: "2026-05-20T00:00:00.000Z"
      },
      monitors: {
        continuityScore: 90,
        driftScore: 5,
        noveltyLoad: 0,
        opennessScore: 80,
        compressionDensity: 70,
        sessionHealth: "healthy"
      },
      diagnostics: {
        stableCoreSummary: [],
        noveltySummary: [],
        opennessSummary: [],
        warnings: [],
        actionsSuggested: [],
        generatedAt: "2026-05-20T00:00:00.000Z"
      },
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z"
    };
    await storage.set(CURRENT_SESSION_KEY, session);
    const route = createMessageRouter(platform(undefined, storage));
    const opened = (await route({
      type: "review:open",
      payload: { result: result() }
    })) as { reviewId: string };

    const status = (await route({
      type: "review:status",
      payload: { reviewId: opened.reviewId }
    })) as { providerHealth?: Record<string, unknown> };

    expect(status.providerHealth).toMatchObject({
      session_key: "session_existing",
      persisted_session_state_present: true,
      session_state_source: "persisted_local_state"
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
