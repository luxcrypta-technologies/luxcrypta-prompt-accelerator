import { describe, expect, it } from "vitest";
import { normalizePrompt } from "@/core/normalize";

describe("normalizePrompt", () => {
  it("normalizes whitespace, bullets, and blank lines conservatively", () => {
    expect(normalizePrompt("  •  Do this\r\n\r\n\r\nUse   JSON  ")).toBe("- Do this\n\nUse JSON");
  });
});
