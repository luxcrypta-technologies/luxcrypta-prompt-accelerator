import type { BrowserCapabilities, ReviewSurfaceKind } from "@/types/platform";

export function chooseReviewSurface(capabilities: BrowserCapabilities): ReviewSurfaceKind {
  if (capabilities.supportsSidePanel) {
    return "side_panel";
  }
  if (capabilities.supportsActionPopup) {
    return "popup_modal";
  }
  return "review_tab";
}

export function reviewPath(reviewId?: string): string {
  const query = reviewId ? `?reviewId=${encodeURIComponent(reviewId)}` : "";
  return `review.html${query}`;
}
