import { describe, expect, it } from "vitest";
import {
  buildSnapshotFromNodes,
  conversationIdFromUrl,
  roleFromMarkers,
  SNAPSHOT_SOFT_CAP
} from "@/surfaces/snapshot";

/**
 * Stage 0 regression tests (defect zero / crossover foundation).
 *
 * Covers the three roots that made capture serve stale, truncated, mis-roled
 * state: per-conversation id parsing (D0a-1), live role attribution + uncapped
 * extraction (D0b). Session-store isolation is covered separately where the
 * storage mock lives.
 */

describe("conversationIdFromUrl — per provider (D0a-1)", () => {
  it.each([
    ["chatgpt", "https://chatgpt.com/c/c861c461-8e43-448c-8477-b00256650001", "c861c461-8e43-448c-8477-b00256650001"],
    ["claude", "https://claude.ai/chat/abc-123-def", "abc-123-def"],
    ["gemini", "https://gemini.google.com/app/9f8e7d6c", "9f8e7d6c"],
    ["deepseek", "https://chat.deepseek.com/a/chat/s/zzz999", "zzz999"],
    ["grok", "https://grok.com/chat/grok-thread-77", "grok-thread-77"],
    ["perplexity", "https://www.perplexity.ai/search/some-slug-abc123", "some-slug-abc123"]
  ])("parses %s thread id", (provider, url, expected) => {
    expect(conversationIdFromUrl(provider, url)).toBe(expected);
  });

  it.each([
    ["claude", "https://claude.ai/new"],
    ["chatgpt", "https://chatgpt.com/"],
    ["gemini", "https://gemini.google.com/app"]
  ])("returns null on the pre-first-message state for %s", (provider, url) => {
    expect(conversationIdFromUrl(provider, url)).toBeNull();
  });

  it("two different threads on the same provider yield different ids", () => {
    const a = conversationIdFromUrl("claude", "https://claude.ai/chat/aaaa");
    const b = conversationIdFromUrl("claude", "https://claude.ai/chat/bbbb");
    expect(a).not.toBe(b);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
  });
});

describe("roleFromMarkers — real DOM signals, not position (D0b)", () => {
  const el = (html: string): HTMLElement => {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.firstElementChild as HTMLElement;
  };

  it("reads user role from data-message-author-role", () => {
    expect(roleFromMarkers(el(`<div data-message-author-role="user">hi</div>`))).toBe("user");
  });

  it("reads assistant role from a model-response tag/class", () => {
    expect(roleFromMarkers(el(`<div class="model-response">answer</div>`))).toBe("assistant");
  });

  it("returns null when no marker is present (lets caller fall back)", () => {
    expect(roleFromMarkers(el(`<div>plain</div>`))).toBeNull();
  });
});

describe("buildSnapshotFromNodes — uncapped + honest scope (D0b)", () => {
  const node = (role: string, text: string): HTMLElement => {
    const d = document.createElement("div");
    if (role) d.setAttribute("data-message-author-role", role);
    d.textContent = text;
    return d;
  };

  it("captures more than the old 12-turn hard cap", () => {
    const nodes: HTMLElement[] = [];
    for (let i = 0; i < 40; i++) {
      nodes.push(node(i % 2 === 0 ? "user" : "assistant", `turn ${i}`));
    }
    const snap = buildSnapshotFromNodes(nodes);
    expect(snap).not.toBeNull();
    expect(snap!.turns.length).toBe(40); // not clamped to 12
    expect(snap!.scope.capture_scope).toBe("full");
    expect(snap!.scope.role_attribution).toBe("dom_markers");
  });

  it("labels scope partial and uses real roles when over the soft cap", () => {
    const nodes: HTMLElement[] = [];
    for (let i = 0; i < SNAPSHOT_SOFT_CAP + 25; i++) {
      nodes.push(node(i % 2 === 0 ? "user" : "assistant", `turn ${i}`));
    }
    const snap = buildSnapshotFromNodes(nodes);
    expect(snap!.turns.length).toBe(SNAPSHOT_SOFT_CAP);
    expect(snap!.scope.capture_scope).toBe("partial");
  });

  it("falls back to positional roles only when markers are absent", () => {
    const plain = [node("", "a"), node("", "b"), node("", "c")];
    const snap = buildSnapshotFromNodes(plain);
    expect(snap!.scope.role_attribution).toBe("positional_fallback");
    expect(snap!.scope.coverage_confidence).toBe("low");
    expect(snap!.turns[0].role).toBe("user");
    expect(snap!.turns[1].role).toBe("assistant");
  });

  it("returns null for an empty conversation", () => {
    expect(buildSnapshotFromNodes([])).toBeNull();
  });
});

describe("cross-chat isolation on the /new window (D0a-1 follow-up)", () => {
  // Before a thread id exists, the conversation key must come from a per-tab
  // ephemeral id — NOT a single shared/global slot. Two fresh chats must not
  // collide. We simulate the content-script's key computation here.
  const keyFor = (provider: string, url: string, ephemeral: string): string => {
    const id = conversationIdFromUrl(provider, url);
    return `${provider}:${id ?? ephemeral}`;
  };

  it("two fresh /new chats in different tabs get different keys", () => {
    const tabA = keyFor("claude", "https://claude.ai/new", "tab-aaa");
    const tabB = keyFor("claude", "https://claude.ai/new", "tab-bbb");
    expect(tabA).not.toBe(tabB);
  });

  it("a real thread id overrides the ephemeral id once the URL updates", () => {
    const ephemeral = keyFor("claude", "https://claude.ai/new", "tab-aaa");
    const real = keyFor("claude", "https://claude.ai/chat/real-uuid-1", "tab-aaa");
    expect(real).toBe("claude:real-uuid-1");
    expect(real).not.toBe(ephemeral);
  });

  it("two different threads never share a key", () => {
    const one = keyFor("claude", "https://claude.ai/chat/uuid-1", "tab-x");
    const two = keyFor("claude", "https://claude.ai/chat/uuid-2", "tab-x");
    expect(one).not.toBe(two);
  });
});
