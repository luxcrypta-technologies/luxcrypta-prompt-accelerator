import type { ChatSurfaceAdapter, ConversationSnapshot } from "./types";

const INPUT_SELECTORS = [
  "rich-textarea div[contenteditable='true']",
  "[contenteditable='true'][aria-label*='Enter a prompt' i]",
  "textarea",
  "div[contenteditable='true']"
];

function queryInput(): HTMLElement | HTMLTextAreaElement | null {
  for (const selector of INPUT_SELECTORS) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement || element instanceof HTMLTextAreaElement) {
      return element;
    }
  }
  return null;
}

function readText(element: HTMLElement | HTMLTextAreaElement | null): string {
  if (!element) return "";
  return element instanceof HTMLTextAreaElement ? element.value : element.textContent ?? "";
}

function writeText(element: HTMLElement | HTMLTextAreaElement | null, text: string): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) {
    element.value = text;
  } else {
    element.textContent = text;
  }
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  return true;
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
    return readText(queryInput());
  },
  setCurrentDraftText(text: string) {
    return writeText(queryInput(), text);
  },
  insertText(text: string) {
    const current = this.getCurrentDraftText();
    return this.setCurrentDraftText(current ? `${current}\n${text}` : text);
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
