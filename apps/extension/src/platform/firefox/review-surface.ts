import { reviewPath } from "@/platform/review-surface";
import type { PlatformReviewSurface } from "@/types/platform";

export const firefoxReviewSurface: PlatformReviewSurface = {
  getPreferredSurface() {
    return "review_tab";
  },

  async openReviewSurface(reviewId?: string): Promise<void> {
    await browser.tabs.create({ url: browser.runtime.getURL(reviewPath(reviewId)) });
  }
};
