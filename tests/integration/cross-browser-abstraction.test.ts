import { describe, expect, it } from "vitest";
import { createExtensionPlatform } from "@/platform/feature-detect";
import { preferredReviewSurface } from "@/app/capabilities";

describe("cross-browser abstraction", () => {
  it("selects equivalent review behavior from capabilities", () => {
    const chromium = createExtensionPlatform("chromium", { sidePanel: {}, action: {}, storage: { local: {} } }, false);
    const firefox = createExtensionPlatform("firefox", { action: {}, storage: { local: {} } }, true);
    expect(preferredReviewSurface(chromium)).toBe("side_panel");
    expect(preferredReviewSurface(firefox)).toBe("popup_modal");
  });
});
