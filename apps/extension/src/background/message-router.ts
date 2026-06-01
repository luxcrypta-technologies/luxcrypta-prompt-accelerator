import { REVIEW_STATE_LIMIT } from "@/app/config";
import { getBuildProvenance } from "@/app/build-info";
import { readConversationSnapshot, readCurrentDraft, applyPrompt } from "./commands";
import { executeContinueSession } from "@/domain/actions/continue-session";
import { executeExportBundle, executeImportBundle } from "@/domain/actions/export-bundle";
import { executePromoteNovelty } from "@/domain/actions/promote-novelty";
import { executeSaveWorkflow } from "@/domain/actions/save-workflow";
import { executeTransformPrompt } from "@/domain/actions/transform-prompt";
import { executeUpdateSessionState } from "@/domain/actions/update-session-state";
import { transformPrompt } from "@/core/pipeline";
import { CapsuleService } from "@/domain/services/capsule-service";
import { HistoryService } from "@/domain/services/history-service";
import { PreferenceService } from "@/domain/services/preference-service";
import { SessionGovernanceService } from "@/domain/services/session-governance-service";
import { CURRENT_SESSION_KEY, reviewStateKey, STORAGE_PREFIXES } from "@/storage/keys";
import type {
  BackgroundMessage,
  BackgroundMessageResult,
  ContentMessage,
  ExtensionMessage,
  ReviewState
} from "@/types/messages";
import type { PlatformAPI, PlatformStorage } from "@/types/platform";
import type { SessionGovernanceState } from "@/types/governance";
import { createDatedId } from "@/utils/ids";
import { nowIso } from "@/utils/time";

const reviewStates = new Map<string, ReviewState>();

/**
 * Read the active tab's live conversation context (snapshot + conversation key)
 * via the content script. This is the Stage-0 fix that makes capture reflect
 * the CURRENT conversation instead of stale persisted/global state. Returns
 * nulls (not throwing) when the surface can't answer, so callers degrade to the
 * legacy in-memory slot rather than failing.
 */
interface ActiveConversationContext {
  snapshot: import("@/types/surfaces").ConversationSnapshot | null;
  provider: string | null;
  conversationId: string | null;
  conversationKey: string | null;
}

async function readActiveConversationContext(
  platform: PlatformAPI,
  sourceTabId?: number | null
): Promise<ActiveConversationContext> {
  try {
    // Prefer the originating conversation tab (captured at review:open). The
    // active tab is wrong when the diagnostic is requested from the review
    // page, which lives in its own tab/window — that was the cause of the
    // cross-tab fallback to the global session slot.
    const res = (await (typeof sourceTabId === "number"
      ? platform.tabs.sendToTab(sourceTabId, { type: "content:snapshot:get" })
      : platform.tabs.sendToActiveTab({ type: "content:snapshot:get" }))) as Partial<
      ActiveConversationContext
    > | null;
    if (!res || typeof res !== "object") {
      return { snapshot: null, provider: null, conversationId: null, conversationKey: null };
    }
    return {
      snapshot: res.snapshot ?? null,
      provider: res.provider ?? null,
      conversationId: res.conversationId ?? null,
      conversationKey: res.conversationKey ?? null
    };
  } catch {
    return { snapshot: null, provider: null, conversationId: null, conversationKey: null };
  }
}

function rememberReviewStateInMemory(state: ReviewState): void {
  reviewStates.set(state.id, state);
  while (reviewStates.size > REVIEW_STATE_LIMIT) {
    const oldestKey = reviewStates.keys().next().value as string | undefined;
    if (!oldestKey) break;
    reviewStates.delete(oldestKey);
  }
}

async function rememberReviewState(state: ReviewState, storage: PlatformStorage): Promise<void> {
  rememberReviewStateInMemory(state);
  await storage.set(reviewStateKey(state.id), state);
  const persisted = await storage.list<ReviewState>(STORAGE_PREFIXES.review);
  const expired = [...persisted]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(REVIEW_STATE_LIMIT);
  await Promise.all(expired.map((review) => storage.remove(reviewStateKey(review.id))));
}

function latestReviewStateInMemory(): ReviewState | null {
  return (
    Array.from(reviewStates.values()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )[0] ?? null
  );
}

async function getReviewState(
  storage: PlatformStorage,
  reviewId?: string
): Promise<ReviewState | null> {
  if (reviewId) {
    const cached = reviewStates.get(reviewId);
    if (cached) return cached;
    const persisted = await storage.get<ReviewState>(reviewStateKey(reviewId));
    if (persisted) rememberReviewStateInMemory(persisted);
    return persisted;
  }
  const cached = latestReviewStateInMemory();
  if (cached) return cached;
  const persisted = await storage.list<ReviewState>(STORAGE_PREFIXES.review);
  const latest =
    [...persisted].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  if (latest) rememberReviewStateInMemory(latest);
  return latest;
}

function appendReviewOpenEvent(state: ReviewState, event: string): void {
  const health = state.result.continuityReview.diagnostics.providerHealth;
  if (!health) return;
  health.review_open_events = [...(health.review_open_events ?? []), event];
}

function markReviewOpenFailure(state: ReviewState, stage: string, reason: string): void {
  const health = state.result.continuityReview.diagnostics.providerHealth;
  if (!health) return;
  health.review_open_attempted = true;
  health.review_open_status = "open_failed";
  health.review_open_stage = "open_failed";
  health.review_open_error = reason;
  health.failure_stage = stage;
  health.failure_reason = reason;
  health.visible_to_user = false;
  health.persisted = true;
  appendReviewOpenEvent(state, `review_open_failed:${stage}`);
}

function attachRuntimeDiagnostics(
  state: ReviewState,
  sessionState: SessionGovernanceState | null,
  sourceTabId?: number | null
): void {
  const diagnostics = state.result.continuityReview.diagnostics;
  const health = diagnostics.providerHealth;
  const routeKey = `${sourceTabId ?? state.sourceTabId ?? "unknown"}:${state.id}`;
  const buildProvenance = getBuildProvenance(
    health?.build_provenance?.extension_version
  );
  diagnostics.build_provenance = buildProvenance;
  if (health) {
    health.route_key = routeKey;
    health.session_key = sessionState?.id;
    health.persisted_session_state_present = Boolean(sessionState);
    health.session_state_source = sessionState ? "persisted_local_state" : "built_fresh_in_session";
    health.build_provenance = buildProvenance;
    diagnostics.runtime_snapshot = {
      provider_name: health.provider,
      active_url: health.active_url,
      active_domain: health.active_domain,
      toolbar_mount_state: {
        toolbar_mounted: health.toolbar_mounted,
        toolbar_root_mounted: health.toolbar_root_mounted,
        toolbar_root_surface: health.toolbar_root_surface,
        dom_mount_status: health.dom_mount_status,
        current_provider_bound: health.toolbar_current_provider_bound
      },
      provider_root_selector_used: health.provider_root_selector_used,
      provider_root_present: health.provider_root_present,
      authored_body_target_present: health.authored_body_target_present,
      route_key: routeKey,
      session_key: sessionState?.id,
      persisted_session_state_present: Boolean(sessionState),
      session_state_source: health.session_state_source,
      build_provenance: buildProvenance
    };
  }
}

function refreshReviewReadinessAfterOpen(state: ReviewState): void {
  const current = state.result;
  const diagnostics = current.continuityReview.diagnostics;
  const refreshed = transformPrompt({
    sourceText: current.originalText,
    mode: diagnostics.requestedMode,
    targetModel: current.targetModelApplied ?? diagnostics.targetModel,
    preserveConstraints: true,
    sourceSurface: diagnostics.sourceSurface,
    providerProfile: diagnostics.providerProfile,
    providerHealth: diagnostics.providerHealth
  });
  state.result = {
    ...refreshed,
    transformedText: current.transformedText
  };
}

function isContentMessage(message: ExtensionMessage): message is ContentMessage {
  return message.type.startsWith("content:");
}

export function createMessageRouter(platform: PlatformAPI) {
  return async function routeMessage(
    message: ExtensionMessage
  ): Promise<BackgroundMessageResult | unknown> {
    if (isContentMessage(message)) {
      if (message.type === "content:draft:get") return readCurrentDraft(platform);
      if (message.type === "content:draft:apply")
        return applyPrompt(platform, message.payload.text, message.payload.targetTabId);
      if (message.type === "content:snapshot:get") return readConversationSnapshot(platform);
    }

    const backgroundMessage = message as BackgroundMessage;
    switch (backgroundMessage.type) {
      case "prompt:transform": {
        const txCtx = await readActiveConversationContext(platform);
        const result = await executeTransformPrompt(backgroundMessage.payload, {
          storage: platform.storage
        });
        await executeUpdateSessionState(
          {
            transformRequest: backgroundMessage.payload,
            transformResult: result,
            conversationKey: txCtx.conversationKey,
            snapshotScope: txCtx.snapshot?.scope ?? null,
            sourceSurface: backgroundMessage.payload.sourceSurface
          },
          { storage: platform.storage }
        );
        return result;
      }
      case "capsule:generate": {
        const capCtx = await readActiveConversationContext(platform);
        const capsule = await executeContinueSession(
          {
            ...backgroundMessage.payload,
            snapshot: backgroundMessage.payload.snapshot ?? capCtx.snapshot ?? undefined,
            conversationKey: capCtx.conversationKey
          },
          {
            storage: platform.storage
          }
        );
        await executeUpdateSessionState(
          {
            capsule,
            conversationSnapshot:
              backgroundMessage.payload.snapshot ?? capCtx.snapshot ?? null,
            conversationKey: capCtx.conversationKey,
            sourceSurface: backgroundMessage.payload.sourceSurface
          },
          { storage: platform.storage }
        );
        return capsule;
      }
      case "capsule:save":
        return new CapsuleService(platform.storage).createFromReview(
          backgroundMessage.payload.capsule
        );
      case "workflow:save":
        return executeSaveWorkflow(backgroundMessage.payload, { storage: platform.storage });
      case "history:list":
        return new HistoryService(platform.storage).list(backgroundMessage.payload?.limit);
      case "preferences:get":
        return new PreferenceService(platform.storage).get();
      case "preferences:update":
        return new PreferenceService(platform.storage).update(backgroundMessage.payload);
      case "export:create":
        return executeExportBundle({ storage: platform.storage });
      case "import:apply":
        return executeImportBundle(backgroundMessage.payload.bundle, { storage: platform.storage });
      case "session:get": {
        const ctx = await readActiveConversationContext(
          platform,
          backgroundMessage.payload?.sourceTabId
        );
        return new SessionGovernanceService(platform.storage).getCurrent(ctx.conversationKey);
      }
      case "session:update":
        return executeUpdateSessionState(backgroundMessage.payload, { storage: platform.storage });
      case "session:promote-novelty":
        return executePromoteNovelty(backgroundMessage.payload, { storage: platform.storage });
      case "session:reset": {
        const ctx = await readActiveConversationContext(
          platform,
          backgroundMessage.payload?.sourceTabId
        );
        return new SessionGovernanceService(platform.storage).reset(ctx.conversationKey);
      }
      case "diagnostics:get": {
        const ctx = await readActiveConversationContext(
          platform,
          backgroundMessage.payload?.sourceTabId
        );
        return new SessionGovernanceService(platform.storage).getDiagnostics(ctx.conversationKey);
      }
      case "review:open": {
        const createdAt = nowIso();
        const surface = platform.reviewSurface.getPreferredSurface();
        const sourceTabId = await platform.tabs.getActiveTabId();
        const activeCtx = await readActiveConversationContext(platform, sourceTabId);
        const currentSession = await new SessionGovernanceService(platform.storage).getCurrent(
          activeCtx.conversationKey
        );
        const result = backgroundMessage.payload.result;
        if (result.continuityReview.diagnostics.providerHealth) {
          result.continuityReview.diagnostics.providerHealth.review_open_attempted = true;
          result.continuityReview.diagnostics.providerHealth.review_open_status = "requested";
          result.continuityReview.diagnostics.providerHealth.review_open_stage = "requested";
          result.continuityReview.diagnostics.providerHealth.navigation_attempted = true;
          result.continuityReview.diagnostics.providerHealth.surface_created = false;
          result.continuityReview.diagnostics.providerHealth.app_mounted = false;
          result.continuityReview.diagnostics.providerHealth.first_content_rendered = false;
          result.continuityReview.diagnostics.providerHealth.visible_to_user = false;
          result.continuityReview.diagnostics.providerHealth.persisted = false;
          result.continuityReview.diagnostics.providerHealth.review_open_events = [
            ...(result.continuityReview.diagnostics.providerHealth.review_open_events ?? []),
            "review_open_requested"
          ];
        }
        const state: ReviewState = {
          id: createDatedId("review", result.transformedText, createdAt),
          result,
          surface,
          createdAt,
          sourceTabId: sourceTabId ?? undefined
        };
        attachRuntimeDiagnostics(state, currentSession, sourceTabId);
        await rememberReviewState(state, platform.storage);
        try {
          await platform.reviewSurface.openReviewSurface(state.id);
        } catch (error) {
          markReviewOpenFailure(
            state,
            "surface_created",
            error instanceof Error ? error.message : String(error)
          );
          await rememberReviewState(state, platform.storage);
          throw error;
        }
        if (state.result.continuityReview.diagnostics.providerHealth) {
          state.result.continuityReview.diagnostics.providerHealth.surface_created = true;
          state.result.continuityReview.diagnostics.providerHealth.persisted = true;
          state.result.continuityReview.diagnostics.providerHealth.review_open_status =
            "surface_created";
          state.result.continuityReview.diagnostics.providerHealth.review_open_stage =
            "surface_created";
          state.result.continuityReview.diagnostics.providerHealth.review_open_events = [
            ...(state.result.continuityReview.diagnostics.providerHealth.review_open_events ?? []),
            "review_surface_created",
            "review_state_persisted",
            "review_open_pending_visible_render"
          ];
        }
        attachRuntimeDiagnostics(state, currentSession, sourceTabId);
        await rememberReviewState(state, platform.storage);
        return {
          reviewId: state.id,
          surface,
          visibleToUser: false,
          openStatus: "surface_created"
        };
      }
      case "review:get":
        return getReviewState(platform.storage, backgroundMessage.payload.reviewId);
      case "review:update": {
        const state = await getReviewState(platform.storage, backgroundMessage.payload.reviewId);
        if (!state) return null;
        const updated: ReviewState = {
          ...state,
          result: backgroundMessage.payload.result
        };
        await rememberReviewState(updated, platform.storage);
        return updated;
      }
      case "review:status": {
        const state = await getReviewState(platform.storage, backgroundMessage.payload.reviewId);
        const health = state?.result.continuityReview.diagnostics.providerHealth;
        return state
          ? {
              reviewId: state.id,
              surface: state.surface,
              visibleToUser: health?.visible_to_user ?? false,
              openStatus: health?.review_open_status ?? "requested",
              providerHealth: health
            }
          : null;
      }
      case "review:rendered": {
        const state = await getReviewState(platform.storage, backgroundMessage.payload.reviewId);
        if (!state) return null;
        const health = state.result.continuityReview.diagnostics.providerHealth;
        if (health) {
          health.review_open_attempted = true;
          health.app_mounted = true;
          health.first_content_rendered = true;
          health.visible_to_user = true;
          health.persisted = true;
          health.review_open_status = "open_success";
          health.review_open_stage = "open_success";
          health.failure_stage = undefined;
          health.failure_reason = undefined;
          health.review_open_events = [
            ...(health.review_open_events ?? []),
            "review_app_mounted",
            "review_first_content_rendered",
            "review_visible_to_user",
            "review_visible_acknowledged",
            "review_state_persisted",
            "review_open_success"
          ];
        }
        refreshReviewReadinessAfterOpen(state);
        const currentSession = await platform.storage.get<SessionGovernanceState>(
          CURRENT_SESSION_KEY
        );
        attachRuntimeDiagnostics(state, currentSession, state.sourceTabId);
        await rememberReviewState(state, platform.storage);
        return {
          reviewId: state.id,
          surface: state.surface,
          visibleToUser: true,
          openStatus: health?.review_open_status ?? "open_success",
          providerHealth: health,
          result: state.result
        };
      }
      default:
        throw new Error("Unsupported message route.");
    }
  };
}
