import { getPlatformAPI } from "@platform-runtime";
import { createToolbarElement } from "./toolbar-entry";
import { observeDom } from "./dom-observer";
import { getCurrentSurface } from "./surface-registry";
import type { BackgroundMessage, ContentMessage } from "@/types/messages";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { UserPreferences } from "@/types/preferences";
import type { TransformResult } from "@/types/prompts";
import type { ChatSurfaceAdapter } from "@/types/surfaces";

const TOOLBAR_ID = "lcpa-toolbar-root";
const platform = getPlatformAPI();

function capsuleToPrompt(capsule: unknown): string {
  return `Carry-forward capsule:\n${JSON.stringify(capsule, null, 2)}`;
}

async function transformDraft(surface: ChatSurfaceAdapter, mode?: "focus"): Promise<void> {
  const sourceText = surface.getCurrentDraftText();
  if (!sourceText.trim()) {
    return;
  }
  const result = await platform.messaging.sendMessage<BackgroundMessage, TransformResult>(
    {
      type: "prompt:transform",
      payload: { sourceText, mode, preserveConstraints: true, sourceSurface: surface.id }
    }
  );
  await platform.messaging.sendMessage<BackgroundMessage, { reviewId: string }>({
    type: "review:open",
    payload: { result }
  });
}

async function continueSession(surface: ChatSurfaceAdapter): Promise<void> {
  const snapshot = surface.getConversationSnapshot?.() ?? null;
  const capsule = await platform.messaging.sendMessage<BackgroundMessage, CarryForwardCapsule>(
    { type: "capsule:generate", payload: { snapshot: snapshot ?? undefined, sourceSurface: surface.id } }
  );
  surface.insertText(capsuleToPrompt(capsule));
}

async function saveWorkflow(surface: ChatSurfaceAdapter): Promise<void> {
  const sourceText = surface.getCurrentDraftText();
  if (!sourceText.trim()) {
    return;
  }
  await platform.messaging.sendMessage<BackgroundMessage, unknown>(
    {
      type: "workflow:save",
      payload: {
        workflow: {
          title: sourceText.split("\n")[0].slice(0, 60) || "Saved workflow",
          objective: sourceText,
          mode: "focus",
          constraints: [],
          outputPreferences: [],
          targetModel: "generic"
        }
      }
    }
  );
}

function injectToolbar(): void {
  const surface = getCurrentSurface();
  if (!surface?.isReady() || document.getElementById(TOOLBAR_ID)) {
    return;
  }
  const input = surface.getInputElement();
  const parent = input?.parentElement;
  if (!input || !parent) {
    return;
  }
  const toolbar = createToolbarElement({
    onCompress: () => void transformDraft(surface),
    onFocus: () => void transformDraft(surface, "focus"),
    onContinue: () => void continueSession(surface),
    onSaveWorkflow: () => void saveWorkflow(surface)
  });
  toolbar.id = TOOLBAR_ID;
  parent.insertBefore(toolbar, input);
}

async function bootstrap(): Promise<void> {
  const preferences = await platform.messaging
    .sendMessage<BackgroundMessage, UserPreferences>({ type: "preferences:get" })
    .catch(() => ({ contextualToolbarEnabled: true }));
  if (preferences.contextualToolbarEnabled !== false) {
    injectToolbar();
    observeDom(injectToolbar);
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
    return { applied: surface.setCurrentDraftText(typedMessage.payload.text) };
  }
  if (typedMessage.type === "content:snapshot:get") {
    return surface.getConversationSnapshot?.() ?? null;
  }
  return null;
});

void bootstrap();
