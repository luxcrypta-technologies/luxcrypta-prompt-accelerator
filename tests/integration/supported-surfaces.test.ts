import { describe, expect, it } from "vitest";
import { CHAT_SURFACES } from "@/surfaces";

describe("supported surfaces", () => {
  it("matches v1 chat hosts", () => {
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://chatgpt.com/c/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://claude.ai/chat/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://gemini.google.com/app"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://example.com"))).toBe(false);
  });
});
