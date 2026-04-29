import { chooseReviewSurface, reviewPath } from "@/platform/review-surface";
import type { PlatformReviewSurface } from "@/types/platform";

function getActiveTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.id ?? null);
    });
  });
}

export const chromiumReviewSurface: PlatformReviewSurface = {
  getPreferredSurface() {
    return chooseReviewSurface({
      supportsSidePanel: typeof chrome.sidePanel !== "undefined",
      supportsBrowserNamespace: false,
      supportsActionPopup: typeof chrome.action !== "undefined",
      supportsStorageLocal: typeof chrome.storage?.local !== "undefined"
    });
  },

  async openReviewSurface(reviewId?: string): Promise<void> {
    const preferred = this.getPreferredSurface();
    if (preferred === "side_panel" && chrome.sidePanel?.open) {
      const tabId = await getActiveTabId();
      if (tabId !== null) {
        try {
          await chrome.sidePanel.open({ tabId });
          return;
        } catch (error) {
          if (!isSidePanelUserGestureError(error)) {
            throw error;
          }
          // Prompt actions often transform locally before opening review, which can outlive
          // Chrome's user-gesture window. Keep the review flow usable with a tab fallback.
        }
      }
    }
    await chrome.tabs.create({ url: chrome.runtime.getURL(reviewPath(reviewId)) });
  }
};

function isSidePanelUserGestureError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);
  return message.includes("sidePanel.open") && message.includes("user gesture");
}
