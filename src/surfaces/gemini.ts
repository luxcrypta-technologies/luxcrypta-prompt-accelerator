import type { ChatSurfaceAdapter, ConversationSnapshot } from "./types";
import { appendDraftText, queryFirstUsableInput, readDraftText, replaceDraftText, type DraftInputElement } from "./dom";

const INPUT_SELECTORS = [
  "rich-textarea div[contenteditable='true']",
  "[contenteditable='true'][aria-label*='Enter a prompt' i]",
  "textarea",
  "div[contenteditable='true']"
];

function queryInput(): DraftInputElement | null {
  return queryFirstUsableInput(INPUT_SELECTORS);
}

export const geminiSurface: ChatSurfaceAdapter = {
  id: "gemini",
  label: "Gemini",
  matches(url: string) {
    return /^https:\/\/gemini\.google\.com\//.test(url);
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
    const turns = Array.from(document.querySelectorAll("user-query, model-response, .query-text, .response-content"))
      .slice(-12)
      .map((node) => {
        const tagName = (node as HTMLElement).tagName.toLowerCase();
        return {
          role: tagName.includes("user") || (node as HTMLElement).className.includes("query") ? "user" : "assistant",
          text: ((node as HTMLElement).textContent ?? "").trim()
        };
      })
      .filter((turn) => turn.text.length > 0) as ConversationSnapshot["turns"];
    return turns.length ? { title: document.title.replace("Gemini", "").trim(), turns } : null;
  }
};
