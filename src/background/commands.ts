import type { ContentMessage, ContentMessageResult } from "@/types/messages";
import type { PlatformAPI } from "@/types/platform";

export function readCurrentDraft(platform: PlatformAPI): Promise<ContentMessageResult> {
  return platform.tabs.sendToActiveTab<ContentMessage, ContentMessageResult>({ type: "content:draft:get" });
}

export function applyPrompt(platform: PlatformAPI, text: string, targetTabId?: number): Promise<ContentMessageResult> {
  const message: ContentMessage = {
    type: "content:draft:apply",
    payload: { text }
  };
  return typeof targetTabId === "number"
    ? platform.tabs.sendToTab<ContentMessage, ContentMessageResult>(targetTabId, message)
    : platform.tabs.sendToActiveTab<ContentMessage, ContentMessageResult>(message);
}

export function readConversationSnapshot(platform: PlatformAPI): Promise<ContentMessageResult> {
  return platform.tabs.sendToActiveTab<ContentMessage, ContentMessageResult>({
    type: "content:snapshot:get"
  });
}
