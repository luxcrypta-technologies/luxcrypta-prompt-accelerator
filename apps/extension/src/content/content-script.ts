import { getPlatformAPI } from "@platform-runtime";
import { observeDom } from "./dom-observer";
import { createToolbarMountController } from "./toolbar-mount";
import { getCurrentSurface } from "./surface-registry";
import type { BackgroundMessage, ContentMessage } from "@/types/messages";
import type { UserPreferences } from "@/types/preferences";
import type { TransformResult } from "@/types/prompts";
import type { ChatSurfaceAdapter } from "@/types/surfaces";

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

async function openAdvancedReview(surface: ChatSurfaceAdapter): Promise<void> {
  const sourceText = surface.getCurrentDraftText().trim() || snapshotToContinuityText(surface);
  if (!sourceText.trim()) {
    return;
  }
  const result = await platform.messaging.sendMessage<BackgroundMessage, TransformResult>(
    {
      type: "prompt:transform",
      payload: { sourceText, preserveConstraints: true, sourceSurface: surface.id }
    }
  );
  await platform.messaging.sendMessage<BackgroundMessage, { reviewId: string }>({
    type: "review:open",
    payload: { result }
  });
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
    return { text: surface.getCurrentDraftText(), surfaceId: surface.id };
  }
  if (typedMessage.type === "content:draft:apply") {
    const applied = surface.setCurrentDraftText(typedMessage.payload.text);
    return { applied, text: surface.getCurrentDraftText(), surfaceId: surface.id };
  }
  if (typedMessage.type === "content:snapshot:get") {
    return surface.getConversationSnapshot?.() ?? null;
  }
  return null;
});

void bootstrap();
