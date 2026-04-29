import { describe, expect, it } from "vitest";
import { detectCapabilities } from "@/platform/feature-detect";
import { chooseReviewSurface } from "@/platform/review-surface";

describe("platform feature detection", () => {
  it("prefers side panel only when available", () => {
    expect(chooseReviewSurface(detectCapabilities({ sidePanel: {}, action: {}, storage: { local: {} } }, false))).toBe(
      "side_panel"
    );
    expect(chooseReviewSurface(detectCapabilities({ action: {}, storage: { local: {} } }, true))).toBe(
      "popup_modal"
    );
  });
});
