import { getPlatformAPI } from "@platform-runtime";
import { observeDom } from "./dom-observer";
import { createToolbarMountController, TOOLBAR_ID } from "./toolbar-mount";
import { getCurrentSurface } from "./surface-registry";
import type { BackgroundMessage, ContentMessage } from "@/types/messages";
import type { UserPreferences } from "@/types/preferences";
import type { TransformResult } from "@/types/prompts";
import type { ChatSurfaceAdapter, ProviderHealth } from "@/types/surfaces";

const platform = getPlatformAPI();

function snapshotToContinuityText(surface: ChatSurfaceAdapter): string {
  const snapshot = surface.getConversationSnapshot?.();
  if (!snapshot?.turns.length) return "";
  return [
    snapshot.title ? `Objective: ${snapshot.title}` : "",
    ...snapshot.turns.map((turn) => `${turn.role}: ${turn.text}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function providerHealth(
  surface: ChatSurfaceAdapter,
  writebackSuccess = false,
  writebackAttempted = false,
  reviewOpen?: {
    attempted?: boolean;
    status?: ProviderHealth["review_open_status"];
    error?: string;
    events?: string[];
    clickDetected?: boolean;
    navigationAttempted?: boolean;
    surfaceCreated?: boolean;
    appMounted?: boolean;
    firstContentRendered?: boolean;
    visibleToUser?: boolean;
    retryCount?: number;
    failureStage?: string;
    failureReason?: string;
  }
): ProviderHealth {
  const runtime_errors: string[] = [];
  let inputDetected = false;
  let draftReadSuccess = false;

  try {
    inputDetected = surface.getInputElement() !== null;
  } catch (error) {
    runtime_errors.push(error instanceof Error ? error.message : "Input detection failed.");
  }

  try {
    surface.getCurrentDraftText();
    draftReadSuccess = true;
  } catch (error) {
    runtime_errors.push(error instanceof Error ? error.message : "Draft read failed.");
  }

  return {
    provider: surface.id,
    surface_detected: true,
    input_detected: inputDetected,
    toolbar_mounted: Boolean(document.getElementById(TOOLBAR_ID)),
    draft_read_success: draftReadSuccess,
    writeback_attempted: writebackAttempted,
    writeback_status: writebackAttempted
      ? writebackSuccess
        ? "success"
        : "failed"
      : "not_attempted",
    writeback_success: writebackSuccess,
    review_open_attempted: reviewOpen?.attempted,
    review_open_status: reviewOpen?.status,
    review_open_error: reviewOpen?.error,
    review_open_events: reviewOpen?.events,
    click_detected: reviewOpen?.clickDetected,
    navigation_attempted: reviewOpen?.navigationAttempted,
    surface_created: reviewOpen?.surfaceCreated,
    app_mounted: reviewOpen?.appMounted,
    first_content_rendered: reviewOpen?.firstContentRendered,
    visible_to_user: reviewOpen?.visibleToUser,
    retry_count: reviewOpen?.retryCount,
    failure_stage: reviewOpen?.failureStage,
    failure_reason: reviewOpen?.failureReason,
    dom_mount_status: document.getElementById("lcpa-toolbar-root")?.dataset
      .mountStatus as ProviderHealth["dom_mount_status"],
    duplicate_guard_active: document.querySelectorAll(`#${TOOLBAR_ID}`).length <= 1,
    runtime_errors
  };
}

function advancedEvent(
  surface: ChatSurfaceAdapter,
  event: string,
  detail?: Record<string, unknown>
): void {
  const payload = {
    event,
    provider: surface.id,
    toolbarMounted: Boolean(document.getElementById(TOOLBAR_ID)),
    mountStatus: document.getElementById("lcpa-toolbar-root")?.dataset.mountStatus,
    ...detail
  };
  window.dispatchEvent(new CustomEvent("luxcrypta:advanced-review", { detail: payload }));
  console.info("LuxCrypta Prompt Review telemetry", payload);
}

async function waitForVisibleReview(reviewId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await platform.messaging
      .sendMessage<BackgroundMessage, { visibleToUser?: boolean } | null>({
        type: "review:status",
        payload: { reviewId }
      })
      .catch(() => null);
    if (status?.visibleToUser) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
  return false;
}

async function openAdvancedReviewOnce(surface: ChatSurfaceAdapter, retry = false): Promise<void> {
  const events = [retry ? "fallback_retry" : "advanced_click"];
  advancedEvent(surface, retry ? "fallback_retry" : "advanced_click");
  const sourceText = surface.getCurrentDraftText().trim() || snapshotToContinuityText(surface);
  if (!sourceText.trim()) {
    advancedEvent(surface, "review_open_timeout", { reason: "empty_source" });
    throw new Error("No draft body was available for Prompt Review.");
  }
  const result = await platform.messaging.sendMessage<BackgroundMessage, TransformResult>({
    type: "prompt:transform",
    payload: {
      sourceText,
      preserveConstraints: true,
      sourceSurface: surface.id,
      providerProfile: surface.getProviderProfile?.(),
      providerHealth: providerHealth(surface, false, false, {
        attempted: true,
        status: "pending",
        events,
        clickDetected: true,
        navigationAttempted: true,
        retryCount: retry ? 1 : 0
      })
    }
  });
  const response = await platform.messaging.sendMessage<
    BackgroundMessage,
    { reviewId: string; visibleToUser?: boolean }
  >({
    type: "review:open",
    payload: { result }
  });
  if (!response?.reviewId) {
    advancedEvent(surface, "review_open_timeout", { reason: "missing_review_id" });
    throw new Error("Prompt Review did not return a review id.");
  }
  advancedEvent(surface, "review_surface_created", { reviewId: response.reviewId });
  const visible = response.visibleToUser || (await waitForVisibleReview(response.reviewId));
  if (!visible) {
    advancedEvent(surface, "review_visible_timeout", {
      reviewId: response.reviewId,
      reason: "first_content_not_confirmed"
    });
    throw new Error("Prompt Review surface opened, but visible content was not confirmed.");
  }
  advancedEvent(surface, retry ? "fallback_retry_success" : "review_open_success", {
    reviewId: response.reviewId
  });
}

async function openAdvancedReview(surface: ChatSurfaceAdapter): Promise<void> {
  try {
    await openAdvancedReviewOnce(surface);
  } catch (firstError) {
    advancedEvent(surface, "review_open_timeout", {
      error: firstError instanceof Error ? firstError.message : String(firstError)
    });
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    try {
      await openAdvancedReviewOnce(surface, true);
    } catch (secondError) {
      advancedEvent(surface, "review_open_failed", {
        error: secondError instanceof Error ? secondError.message : String(secondError)
      });
      throw secondError;
    }
  }
}

const toolbarMount = createToolbarMountController({
  getSurface: getCurrentSurface,
  onAdvanced: (surface) => void openAdvancedReview(surface),
  observeDom
});

async function bootstrap(): Promise<void> {
  const preferences = await platform.messaging
    .sendMessage<BackgroundMessage, UserPreferences>({ type: "preferences:get" })
    .catch(() => ({ contextualToolbarEnabled: true }));
  if (preferences.contextualToolbarEnabled !== false) {
    toolbarMount.ensureToolbarMounted();
    toolbarMount.observeRootContainerReplacement();
    toolbarMount.observeChatGPTNavigationChanges();
    toolbarMount.startToolbarHealthMonitor();
  }
}

platform.messaging.onMessage((message: unknown) => {
  const surface = getCurrentSurface();
  const typedMessage = message as ContentMessage;
  if (!surface) {
    return null;
  }
  if (typedMessage.type === "content:draft:get") {
    return {
      text: surface.getCurrentDraftText(),
      surfaceId: surface.id,
      providerProfile: surface.getProviderProfile?.(),
      providerHealth: providerHealth(surface)
    };
  }
  if (typedMessage.type === "content:draft:apply") {
    const applied = surface.setCurrentDraftText(typedMessage.payload.text);
    return {
      applied,
      text: surface.getCurrentDraftText(),
      surfaceId: surface.id,
      providerProfile: surface.getProviderProfile?.(),
      providerHealth: providerHealth(surface, applied, true)
    };
  }
  if (typedMessage.type === "content:snapshot:get") {
    return surface.getConversationSnapshot?.() ?? null;
  }
  return null;
});

void bootstrap();
