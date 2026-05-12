import { createExtensionPlatform } from "@/platform/feature-detect";
import type { PlatformAPI } from "@/types/platform";
import { chromiumMessaging } from "./messaging";
import { chromiumReviewSurface } from "./review-surface";
import { chromiumStorage } from "./storage";

const chromiumTabs: PlatformAPI["tabs"] = {
  getActiveTabId(): Promise<number | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.id ?? null);
      });
    });
  },

  async sendToActiveTab<TReq, TRes>(message: TReq): Promise<TRes> {
    const tabId = await this.getActiveTabId();
    if (tabId === null) {
      throw new Error("No active tab is available.");
    }
    return this.sendToTab<TReq, TRes>(tabId, message);
  },

  sendToTab<TReq, TRes>(tabId: number, message: TReq): Promise<TRes> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (response && response.ok === false) {
          reject(new Error(response.error));
          return;
        }
        resolve(response && response.ok ? response.data : response);
      });
    });
  },

  openTab(path: string): Promise<void> {
    return chrome.tabs.create({ url: chrome.runtime.getURL(path) }).then(() => undefined);
  }
};

export function getPlatformAPI(): PlatformAPI {
  return {
    getPlatform() {
      return createExtensionPlatform("chromium", chrome, false);
    },
    storage: chromiumStorage,
    messaging: chromiumMessaging,
    tabs: chromiumTabs,
    reviewSurface: chromiumReviewSurface
  };
}
