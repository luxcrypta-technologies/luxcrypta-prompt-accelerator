import { describe, expect, it } from "vitest";
import { CHAT_SURFACES } from "@/surfaces";

describe("supported surfaces", () => {
  it("matches v1 chat hosts", () => {
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://chatgpt.com/c/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://claude.ai/chat/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://gemini.google.com/app"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://example.com"))).toBe(false);
  });

  it("falls back to visible contenteditable inputs and replaces drafts", () => {
    document.body.innerHTML = `
      <div contenteditable="true" style="display:none">hidden</div>
      <main>
        <div class="ProseMirror" contenteditable="true" aria-label="Message Claude">hello</div>
      </main>
    `;
    const surface = CHAT_SURFACES.find((candidate) => candidate.matches("https://claude.ai/new"));

    expect(surface?.isReady()).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("hello");
    expect(surface?.setCurrentDraftText("replacement")).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("replacement");
  });
});
