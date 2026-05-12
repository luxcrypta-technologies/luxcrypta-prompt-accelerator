import type { ChatSurfaceAdapter, ConversationSnapshot } from "./types";
import { appendDraftText, queryFirstUsableInput, readDraftText, replaceDraftText, type DraftInputElement } from "./dom";

const INPUT_SELECTORS = [
  "div.ProseMirror[contenteditable='true']",
  "[contenteditable='true'][aria-label*='message' i]",
  "textarea",
  "div[contenteditable='true']"
];

function queryInput(): DraftInputElement | null {
  return queryFirstUsableInput(INPUT_SELECTORS);
}

export const claudeSurface: ChatSurfaceAdapter = {
  id: "claude",
  label: "Claude",
  matches(url: string) {
    return /^https:\/\/claude\.ai\//.test(url);
  },
  isReady() {
    return queryInput() !== null;
  },
  getInputElement: queryInput,
  getCurrentDraftText() {
    return readDraftText(queryInput());
  },
  setCurrentDraftText(text: string) {
    return replaceDraftText(queryInput(), text);
  },
  insertText(text: string) {
    return appendDraftText(queryInput(), text);
  },
  getConversationSnapshot(): ConversationSnapshot | null {
    const candidates = Array.from(
      document.querySelectorAll("[data-testid*='message'], article, [class*='message']")
    )
      .slice(-12)
      .map((node, index) => ({
        role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
        text: ((node as HTMLElement).textContent ?? "").trim()
      }))
      .filter((turn) => turn.text.length > 0);
    return candidates.length ? { title: document.title.replace("Claude", "").trim(), turns: candidates } : null;
  }
};
