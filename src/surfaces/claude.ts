import type { ChatSurfaceAdapter, ConversationSnapshot } from "./types";

const INPUT_SELECTORS = [
  "div.ProseMirror[contenteditable='true']",
  "[contenteditable='true'][aria-label*='message' i]",
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
