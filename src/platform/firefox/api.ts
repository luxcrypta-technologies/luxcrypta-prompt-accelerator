import { createExtensionPlatform } from "@/platform/feature-detect";
import type { PlatformAPI } from "@/types/platform";
import { firefoxMessaging } from "./messaging";
import { firefoxReviewSurface } from "./review-surface";
import { firefoxStorage } from "./storage";

const firefoxTabs: PlatformAPI["tabs"] = {
  async getActiveTabId(): Promise<number | null> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
  },

  async sendToActiveTab<TReq, TRes>(message: TReq): Promise<TRes> {
    const tabId = await this.getActiveTabId();
    if (tabId === null) {
      throw new Error("No active tab is available.");
    }
    return this.sendToTab<TReq, TRes>(tabId, message);
  },

  async sendToTab<TReq, TRes>(tabId: number, message: TReq): Promise<TRes> {
    const response = await browser.tabs.sendMessage(tabId, message);
    if (response && response.ok === false) {
      throw new Error(response.error);
    }
    return response && response.ok ? response.data : response;
  },

  async openTab(path: string): Promise<void> {
    await browser.tabs.create({ url: browser.runtime.getURL(path) });
  }
};

export function getPlatformAPI(): PlatformAPI {
  return {
    getPlatform() {
      return createExtensionPlatform("firefox", browser, true);
    },
    storage: firefoxStorage,
    messaging: firefoxMessaging,
    tabs: firefoxTabs,
    reviewSurface: firefoxReviewSurface
  };
}
