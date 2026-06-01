import type { ChatSurfaceAdapter, ConversationSnapshot } from "./types";
import { SNAPSHOT_SOFT_CAP, conversationIdFromUrl } from "./snapshot";
import { appendDraftText, queryFirstUsableInput, readBodyFirstDraftText, replaceDraftText, type DraftInputElement } from "./dom";

const INPUT_SELECTORS = [
  "div.ProseMirror[contenteditable='true']",
  "[contenteditable='true'][aria-label*='Grok' i]",
  "[contenteditable='true'][aria-label*='Ask' i]",
  "[contenteditable='true'][data-placeholder*='Ask' i]",
  "[contenteditable='true'][role='textbox']",
  "textarea[aria-label*='Grok' i]",
  "textarea[placeholder*='Grok' i]",
  "textarea[placeholder*='Ask' i]",
  "textarea",
  "div[contenteditable='true']"
];

const BODY_SELECTORS = [
  "div.ProseMirror[contenteditable='true']",
  "[data-testid*='composer' i] [contenteditable='true']",
  "[contenteditable='true'][aria-label*='Grok' i]",
  "[contenteditable='true'][aria-label*='Ask' i]",
  "main [contenteditable='true']",
  "textarea"
];

const SNAPSHOT_SELECTORS = [
  "[data-message-author-role]",
  "[data-testid*='conversation' i]",
  "[data-testid*='message' i]",
  "article"
];

function queryInput(): DraftInputElement | null {
  return queryFirstUsableInput(INPUT_SELECTORS);
}

function compactText(value: string): string {
  return value
    .replace(/[\t\r\n\f\v]+/g, " ")
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roleFromElement(element: HTMLElement, index: number): ConversationSnapshot["turns"][number]["role"] {
  const marker = [
    element.dataset.messageAuthorRole,
    element.dataset.testid,
    element.getAttribute("aria-label"),
    element.className
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (marker.includes("user") || marker.includes("human")) return "user";
  if (marker.includes("assistant") || marker.includes("grok") || marker.includes("response")) return "assistant";
  return index % 2 === 0 ? "user" : "assistant";
}

export const grokSurface: ChatSurfaceAdapter = {
  id: "grok",
  label: "Grok",
  matches(url: string) {
    return /^https:\/\/grok\.com\//.test(url);
  },
  isReady() {
    return queryInput() !== null;
  },
  getInputElement: queryInput,
  getCurrentDraftText() {
    return readBodyFirstDraftText(queryInput(), BODY_SELECTORS);
  },
  setCurrentDraftText(text: string) {
    return replaceDraftText(queryInput(), text);
  },
  insertText(text: string) {
    return appendDraftText(queryInput(), text);
  },
  getConversationSnapshot(): ConversationSnapshot | null {
    const input = queryInput();
    const seen = new Set<string>();
    const turns = Array.from(document.querySelectorAll(SNAPSHOT_SELECTORS.join(",")))
      .slice(-SNAPSHOT_SOFT_CAP)
      .map((node, index) => {
        const element = node as HTMLElement;
        if (input && element.contains(input)) return null;
        const text = compactText(element.textContent ?? "").slice(0, 2000);
        if (!text || seen.has(text)) return null;
        seen.add(text);
        return {
          role: roleFromElement(element, index),
          text
        };
      })
      .filter((turn): turn is ConversationSnapshot["turns"][number] => Boolean(turn));

    return turns.length ? { title: document.title.replace("Grok", "").trim(), turns } : null;
  },
  getConversationId(url: string = window.location.href) {
    return conversationIdFromUrl("grok", url);
  }
};
