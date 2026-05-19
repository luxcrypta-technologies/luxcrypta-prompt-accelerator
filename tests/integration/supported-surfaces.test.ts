import { describe, expect, it } from "vitest";
import { CHAT_SURFACES } from "@/surfaces";

describe("supported surfaces", () => {
  const providerFixtures = [
    {
      label: "ChatGPT",
      url: "https://chatgpt.com/c/1",
      html: `
        <main>
          <div id="prompt-textarea" contenteditable="true" data-testid="prompt-textarea">draft one</div>
        </main>
      `
    },
    {
      label: "Claude",
      url: "https://claude.ai/chat/1",
      html: `
        <main>
          <div class="ProseMirror" contenteditable="true" aria-label="Message Claude">draft one</div>
        </main>
      `
    },
    {
      label: "Gemini",
      url: "https://gemini.google.com/app",
      html: `
        <main>
          <rich-textarea>
            <div contenteditable="true" aria-label="Enter a prompt here">draft one</div>
          </rich-textarea>
        </main>
      `
    },
    {
      label: "Grok",
      url: "https://grok.com/chat/1",
      html: `
        <main>
          <div class="ProseMirror" contenteditable="true" aria-label="Ask Grok">draft one</div>
        </main>
      `
    }
  ];

  it("matches v1 chat hosts", () => {
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://chatgpt.com/c/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://claude.ai/chat/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://gemini.google.com/app"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://grok.com/chat/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://example.com"))).toBe(false);
  });

  it.each(providerFixtures)("$label replaces drafts without duplicate insertion", ({ url, html }) => {
    document.body.innerHTML = html;
    const surface = CHAT_SURFACES.find((candidate) => candidate.matches(url));

    expect(surface?.isReady()).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("draft one");
    expect(surface?.setCurrentDraftText("replacement one")).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("replacement one");
    expect(surface?.setCurrentDraftText("replacement two")).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("replacement two");
    expect(surface?.getCurrentDraftText()).not.toContain("replacement one");
  });

  it.each(providerFixtures)("$label emits input and change events after writeback", ({ url, html }) => {
    document.body.innerHTML = html;
    const surface = CHAT_SURFACES.find((candidate) => candidate.matches(url));
    const input = surface?.getInputElement();
    const events: string[] = [];
    input?.addEventListener("input", () => events.push("input"));
    input?.addEventListener("change", () => events.push("change"));

    expect(surface?.setCurrentDraftText("event replacement")).toBe(true);
    expect(events).toEqual(["input", "change"]);
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

  it("reads and writes Grok ProseMirror drafts safely", () => {
    document.body.innerHTML = `
      <main>
        <div class="ProseMirror" contenteditable="true" aria-label="Ask Grok">hello grok</div>
      </main>
    `;
    const surface = CHAT_SURFACES.find((candidate) => candidate.matches("https://grok.com/"));

    expect(surface?.isReady()).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("hello grok");
    expect(surface?.setCurrentDraftText("replacement")).toBe(true);
    expect(surface?.insertText("next step")).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("replacement\nnext step");
  });

  it("falls back to Grok visible textbox inputs if primary selectors drift", () => {
    document.body.innerHTML = `
      <main>
        <div class="ProseMirror" contenteditable="true" style="display:none">hidden</div>
        <div contenteditable="true" role="textbox" aria-label="Ask anything">fallback draft</div>
      </main>
    `;
    const surface = CHAT_SURFACES.find((candidate) => candidate.matches("https://grok.com/"));

    expect(surface?.isReady()).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("fallback draft");
  });

  it("supports Grok textarea drafts when the web surface exposes one", () => {
    document.body.innerHTML = `
      <main>
        <textarea aria-label="Ask Grok anything">textarea draft</textarea>
      </main>
    `;
    const surface = CHAT_SURFACES.find((candidate) => candidate.matches("https://grok.com/"));

    expect(surface?.isReady()).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("textarea draft");
    expect(surface?.setCurrentDraftText("textarea replacement")).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("textarea replacement");
  });

  it("keeps Grok conversation snapshots shallow and excludes the active draft", () => {
    document.title = "Planning - Grok";
    document.body.innerHTML = `
      <article data-testid="user-message">Objective: add Grok support.</article>
      <article data-testid="assistant-message">Use the official web surface first.</article>
      <form>
        <div class="ProseMirror" contenteditable="true" aria-label="Ask Grok">draft should stay out</div>
      </form>
    `;
    const surface = CHAT_SURFACES.find((candidate) => candidate.matches("https://grok.com/"));
    const snapshot = surface?.getConversationSnapshot?.();

    expect(snapshot?.turns).toHaveLength(2);
    expect(snapshot?.turns.map((turn) => turn.text).join(" ")).not.toContain("draft should stay out");
  });
});
