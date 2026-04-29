import { REVIEW_STATE_LIMIT } from "@/app/config";
import { readConversationSnapshot, readCurrentDraft, applyPrompt } from "./commands";
import { executeContinueSession } from "@/domain/actions/continue-session";
import { executeExportBundle, executeImportBundle } from "@/domain/actions/export-bundle";
import { executePromoteNovelty } from "@/domain/actions/promote-novelty";
import { executeGetDiagnostics, executeReviewSessionState } from "@/domain/actions/review-session-state";
import { executeSaveWorkflow } from "@/domain/actions/save-workflow";
import { executeTransformPrompt } from "@/domain/actions/transform-prompt";
import { executeUpdateSessionState } from "@/domain/actions/update-session-state";
import { HistoryService } from "@/domain/services/history-service";
import { PreferenceService } from "@/domain/services/preference-service";
import { SessionGovernanceService } from "@/domain/services/session-governance-service";
import type {
  BackgroundMessage,
  BackgroundMessageResult,
  ContentMessage,
  ExtensionMessage,
  ReviewState
} from "@/types/messages";
import type { PlatformAPI } from "@/types/platform";
import { createDatedId } from "@/utils/ids";
import { nowIso } from "@/utils/time";

const reviewStates = new Map<string, ReviewState>();

function rememberReviewState(state: ReviewState): void {
  reviewStates.set(state.id, state);
  while (reviewStates.size > REVIEW_STATE_LIMIT) {
    const oldestKey = reviewStates.keys().next().value as string | undefined;
    if (!oldestKey) break;
    reviewStates.delete(oldestKey);
  }
}

function latestReviewState(): ReviewState | null {
  return Array.from(reviewStates.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function isContentMessage(message: ExtensionMessage): message is ContentMessage {
  return message.type.startsWith("content:");
}

export function createMessageRouter(platform: PlatformAPI) {
  return async function routeMessage(message: ExtensionMessage): Promise<BackgroundMessageResult | unknown> {
    if (isContentMessage(message)) {
      if (message.type === "content:draft:get") return readCurrentDraft(platform);
      if (message.type === "content:draft:apply") return applyPrompt(platform, message.payload.text, message.payload.targetTabId);
      if (message.type === "content:snapshot:get") return readConversationSnapshot(platform);
    }

    const backgroundMessage = message as BackgroundMessage;
    switch (backgroundMessage.type) {
      case "prompt:transform": {
        const result = await executeTransformPrompt(backgroundMessage.payload, { storage: platform.storage });
        await executeUpdateSessionState(
          {
            transformRequest: backgroundMessage.payload,
            transformResult: result,
            sourceSurface: backgroundMessage.payload.sourceSurface
          },
          { storage: platform.storage }
        );
        return result;
      }
      case "capsule:generate": {
        const capsule = await executeContinueSession(backgroundMessage.payload, { storage: platform.storage });
        await executeUpdateSessionState(
          {
            capsule,
            conversationSnapshot: backgroundMessage.payload.snapshot ?? null,
            sourceSurface: backgroundMessage.payload.sourceSurface
          },
          { storage: platform.storage }
        );
        return capsule;
      }
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
      case "session:get":
        return executeReviewSessionState({ storage: platform.storage });
      case "session:update":
        return executeUpdateSessionState(backgroundMessage.payload, { storage: platform.storage });
      case "session:promote-novelty":
        return executePromoteNovelty(backgroundMessage.payload, { storage: platform.storage });
      case "session:reset":
        return new SessionGovernanceService(platform.storage).reset();
      case "diagnostics:get":
        return executeGetDiagnostics({ storage: platform.storage });
      case "review:open": {
        const createdAt = nowIso();
        const surface = platform.reviewSurface.getPreferredSurface();
        const sourceTabId = await platform.tabs.getActiveTabId();
        const state: ReviewState = {
          id: createDatedId("review", backgroundMessage.payload.result.transformedText, createdAt),
          result: backgroundMessage.payload.result,
          surface,
          createdAt,
          sourceTabId: sourceTabId ?? undefined
        };
        rememberReviewState(state);
        await platform.reviewSurface.openReviewSurface(state.id);
        return { reviewId: state.id, surface };
      }
      case "review:get":
        return backgroundMessage.payload.reviewId
          ? reviewStates.get(backgroundMessage.payload.reviewId) ?? null
          : latestReviewState();
      default:
        throw new Error("Unsupported message route.");
    }
  };
}
