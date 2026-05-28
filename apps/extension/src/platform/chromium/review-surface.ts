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
    const path = reviewPath(reviewId);
    const preferred = this.getPreferredSurface();
    if (preferred === "side_panel" && chrome.sidePanel?.open) {
      const tabId = await getActiveTabId();
      if (tabId !== null) {
        try {
          await chrome.sidePanel.setOptions?.({ tabId, path, enabled: true });
          await chrome.sidePanel.open({ tabId });
          return;
        } catch {
          // Prompt actions often transform locally before opening review, which can outlive
          // Chrome's user-gesture window. A tab fallback also avoids stale side-panel mounts.
        }
      }
    }
    await chrome.tabs.create({ url: chrome.runtime.getURL(path) });
  }
};
