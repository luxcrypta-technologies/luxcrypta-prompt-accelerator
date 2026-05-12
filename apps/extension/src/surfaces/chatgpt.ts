import type { ChatSurfaceAdapter, ConversationSnapshot } from "./types";
import { appendDraftText, queryFirstUsableInput, readDraftText, replaceDraftText, type DraftInputElement } from "./dom";

const INPUT_SELECTORS = [
  "#prompt-textarea",
  "textarea[data-id='root']",
  "textarea",
  "div[contenteditable='true'][data-testid*='prompt']",
  "div[contenteditable='true']"
];

function queryInput(): DraftInputElement | null {
  return queryFirstUsableInput(INPUT_SELECTORS);
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
    return readDraftText(queryInput());
  },
  setCurrentDraftText(text: string) {
    return replaceDraftText(queryInput(), text);
  },
  insertText(text: string) {
    return appendDraftText(queryInput(), text);
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
