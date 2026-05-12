export type ReviewSurfaceKind = "side_panel" | "popup_modal" | "review_tab";

export interface BrowserCapabilities {
  supportsSidePanel: boolean;
  supportsBrowserNamespace: boolean;
  supportsActionPopup: boolean;
  supportsStorageLocal: boolean;
}

export interface ExtensionPlatform {
  name: "chromium" | "firefox" | "unknown";
  capabilities: BrowserCapabilities;
}

export interface PlatformStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  list<T>(prefix: string): Promise<T[]>;
}

export interface PlatformMessaging {
  sendMessage<TReq, TRes>(message: TReq): Promise<TRes>;
  onMessage(handler: (message: unknown) => Promise<unknown> | unknown): void;
}

export interface PlatformTabs {
  sendToActiveTab<TReq, TRes>(message: TReq): Promise<TRes>;
  sendToTab<TReq, TRes>(tabId: number, message: TReq): Promise<TRes>;
  openTab(path: string): Promise<void>;
  getActiveTabId(): Promise<number | null>;
}

export interface PlatformReviewSurface {
  getPreferredSurface(): ReviewSurfaceKind;
  openReviewSurface(reviewId?: string): Promise<void>;
}

export interface PlatformAPI {
  getPlatform(): ExtensionPlatform;
  storage: PlatformStorage;
  messaging: PlatformMessaging;
  tabs: PlatformTabs;
  reviewSurface: PlatformReviewSurface;
}
