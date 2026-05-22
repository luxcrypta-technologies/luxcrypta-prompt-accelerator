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
    },
    {
      label: "DeepSeek",
      url: "https://chat.deepseek.com/a/chat/s/1",
      html: `
        <main>
          <textarea aria-label="Message DeepSeek">draft one</textarea>
        </main>
      `
    },
    {
      label: "Perplexity",
      url: "https://www.perplexity.ai/search/example",
      html: `
        <main>
          <textarea aria-label="Ask anything">draft one</textarea>
        </main>
      `
    }
  ];

  it("matches v1 chat hosts", () => {
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://chatgpt.com/c/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://claude.ai/chat/1"))).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://gemini.google.com/app"))).toBe(
      true
    );
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://grok.com/chat/1"))).toBe(true);
    expect(
      CHAT_SURFACES.some((surface) => surface.matches("https://chat.deepseek.com/a/chat/s/1"))
    ).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://www.deepseek.com/chat"))).toBe(
      true
    );
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://deepseek.com/chat"))).toBe(
      true
    );
    expect(
      CHAT_SURFACES.some((surface) => surface.matches("https://perplexity.ai/search/example"))
    ).toBe(true);
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://www.perplexity.ai/"))).toBe(
      true
    );
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://platform.deepseek.com/"))).toBe(
      false
    );
    expect(CHAT_SURFACES.some((surface) => surface.matches("https://example.com"))).toBe(false);
  });

  it.each(providerFixtures)(
    "$label replaces drafts without duplicate insertion",
    ({ url, html }) => {
      document.body.innerHTML = html;
      const surface = CHAT_SURFACES.find((candidate) => candidate.matches(url));

      expect(surface?.isReady()).toBe(true);
      expect(surface?.getCurrentDraftText()).toBe("draft one");
      expect(surface?.setCurrentDraftText("replacement one")).toBe(true);
      expect(surface?.getCurrentDraftText()).toBe("replacement one");
      expect(surface?.setCurrentDraftText("replacement two")).toBe(true);
      expect(surface?.getCurrentDraftText()).toBe("replacement two");
      expect(surface?.getCurrentDraftText()).not.toContain("replacement one");
    }
  );

  it.each(providerFixtures)(
    "$label emits input and change events after writeback",
    ({ url, html }) => {
      document.body.innerHTML = html;
      const surface = CHAT_SURFACES.find((candidate) => candidate.matches(url));
      const input = surface?.getInputElement();
      const events: string[] = [];
      input?.addEventListener("input", () => events.push("input"));
      input?.addEventListener("change", () => events.push("change"));

      expect(surface?.setCurrentDraftText("event replacement")).toBe(true);
      expect(events).toEqual(["input", "change"]);
    }
  );

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
    expect(snapshot?.turns.map((turn) => turn.text).join(" ")).not.toContain(
      "draft should stay out"
    );
  });

  it("exposes DeepSeek structured reasoning provider profile", () => {
    const surface = CHAT_SURFACES.find((candidate) => candidate.id === "deepseek");

    expect(surface?.getProviderProfile?.().continuity_style).toBe("structured_reasoning");
    expect(surface?.getProviderProfile?.().risk_profile).toContain("over_compression");
  });

  it("keeps Perplexity retrieved source context provisional in snapshots", () => {
    document.title = "Research - Perplexity";
    document.body.innerHTML = `
      <main>
        <article data-testid="query">Objective: preserve Stable State while researching.</article>
        <article data-testid="answer">Stable State remains the governing frame.</article>
        <section data-testid="source-card">External source says a partial answer may conflict.</section>
        <form>
          <textarea aria-label="Ask anything">draft should stay out</textarea>
        </form>
      </main>
    `;
    const surface = CHAT_SURFACES.find((candidate) =>
      candidate.matches("https://perplexity.ai/search/example")
    );
    const snapshot = surface?.getConversationSnapshot?.();

    expect(surface?.getProviderProfile?.().retrieved_content_default_state).toBe(
      "provisional_or_quarantine"
    );
    expect(snapshot?.turns.map((turn) => turn.text).join(" ")).toContain(
      "Retrieved evidence (provisional)"
    );
    expect(snapshot?.turns.map((turn) => turn.text).join(" ")).not.toContain(
      "draft should stay out"
    );
  });

  it("targets the visible Perplexity composer instead of mirrored decoy inputs", () => {
    document.body.innerHTML = `
      <main>
        <textarea class="hidden mirrored decoy" aria-label="Ask anything">decoy draft</textarea>
        <form data-testid="composer">
          <textarea aria-label="Ask Perplexity">real draft</textarea>
        </form>
      </main>
    `;
    const surface = CHAT_SURFACES.find((candidate) =>
      candidate.matches("https://www.perplexity.ai/search/example")
    );

    expect(surface?.getCurrentDraftText()).toBe("real draft");
    expect(surface?.setCurrentDraftText("verified writeback")).toBe(true);
    expect(surface?.getCurrentDraftText()).toBe("verified writeback");
  });
});
