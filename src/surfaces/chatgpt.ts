import type { ChatSurfaceAdapter, ConversationSnapshot } from "./types";

const INPUT_SELECTORS = [
  "#prompt-textarea",
  "textarea[data-id='root']",
  "textarea",
  "div[contenteditable='true'][data-testid*='prompt']",
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

function readElementText(element: HTMLElement | HTMLTextAreaElement | null): string {
  if (!element) return "";
  if (element instanceof HTMLTextAreaElement) return element.value;
  return element.textContent ?? "";
}

function writeElementText(element: HTMLElement | HTMLTextAreaElement | null, text: string): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) {
    element.value = text;
  } else {
    element.textContent = text;
  }
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  return true;
}

function roleFromDataset(role: string | undefined): ConversationSnapshot["turns"][number]["role"] {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }
  return "unknown";
}

export const chatgptSurface: ChatSurfaceAdapter = {
  id: "chatgpt",
  label: "ChatGPT",
  matches(url: string) {
    return /^https:\/\/(chat\.openai\.com|chatgpt\.com)\//.test(url);
  },
  isReady() {
    return queryInput() !== null;
  },
  getInputElement: queryInput,
  getCurrentDraftText() {
    return readElementText(queryInput());
  },
  setCurrentDraftText(text: string) {
    return writeElementText(queryInput(), text);
  },
  insertText(text: string) {
    const current = this.getCurrentDraftText();
    return this.setCurrentDraftText(current ? `${current}\n${text}` : text);
  },
  getConversationSnapshot(): ConversationSnapshot | null {
    const turns = Array.from(document.querySelectorAll("[data-message-author-role]"))
      .slice(-12)
      .map((node) => {
        const element = node as HTMLElement;
        return {
          role: roleFromDataset(element.dataset.messageAuthorRole),
          text: (element.textContent ?? "").trim()
        };
      })
      .filter((turn) => turn.text);
    return turns.length > 0 ? { title: document.title.replace(" - ChatGPT", ""), turns } : null;
  }
};
