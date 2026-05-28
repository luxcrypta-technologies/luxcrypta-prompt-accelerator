import { afterEach, describe, expect, it, vi } from "vitest";
import { chromiumReviewSurface } from "@/platform/chromium/review-surface";

function stubChromeSidePanel(options?: { openRejects?: boolean }) {
  const setOptions = vi.fn().mockResolvedValue(undefined);
  const open = options?.openRejects
    ? vi.fn().mockRejectedValue(new Error("sidePanel.open() may only be called in response to a user gesture"))
    : vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue(undefined);

  vi.stubGlobal("chrome", {
    sidePanel: { setOptions, open },
    action: {},
    storage: { local: {} },
    tabs: {
      query: vi.fn(
        (_query: unknown, callback: (tabs: Array<{ id: number }>) => void) =>
          callback([{ id: 42 }])
      ),
      create
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://luxcrypta/${path}`
    }
  });

  return { setOptions, open, create };
}

describe("review surface open routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("binds the Chromium side panel to the current review id before opening", async () => {
    const chromeMock = stubChromeSidePanel();

    await chromiumReviewSurface.openReviewSurface("review_current");

    expect(chromeMock.setOptions).toHaveBeenCalledWith({
      tabId: 42,
      path: "review.html?reviewId=review_current",
      enabled: true
    });
    expect(chromeMock.open).toHaveBeenCalledWith({ tabId: 42 });
    expect(chromeMock.create).not.toHaveBeenCalled();
  });

  it("falls back to a review tab when the side panel cannot open from the click route", async () => {
    const chromeMock = stubChromeSidePanel({ openRejects: true });

    await chromiumReviewSurface.openReviewSurface("review_current");

    expect(chromeMock.create).toHaveBeenCalledWith({
      url: "chrome-extension://luxcrypta/review.html?reviewId=review_current"
    });
  });
});
