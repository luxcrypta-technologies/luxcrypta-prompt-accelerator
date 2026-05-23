import type { ChatSurfaceAdapter, ConversationSnapshot, ProviderProfile } from "./types";
import {
  appendDraftText,
  queryFirstUsableInput,
  readDraftText,
  replaceDraftText,
  type DraftInputElement
} from "./dom";

const INPUT_SELECTORS = [
  "rich-textarea div[contenteditable='true']",
  "[contenteditable='true'][aria-label*='Enter a prompt' i]",
  "textarea",
  "div[contenteditable='true']"
];

export const GEMINI_PROVIDER_PROFILE: ProviderProfile = {
  provider: "gemini",
  continuity_style: "pseudo_formal_wrapper_prone",
  preferred_handoff: "clean_state_without_decorative_formality",
  capsule_bias: "strip_enforcement_theater",
  risk_profile: [
    "enforcement_theater",
    "impractical_external_dependency_inflation",
    "pseudo_formal_scaffolding"
  ],
  recommended_runtime_emphasis: [
    "strip decorative formality unless user-authored",
    "penalize impractical external dependency inflation",
    "preserve semantic state without pseudo-formal wrapper language"
  ]
};

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
    const turns = Array.from(
      document.querySelectorAll("user-query, model-response, .query-text, .response-content")
    )
      .slice(-12)
      .map((node) => {
        const tagName = (node as HTMLElement).tagName.toLowerCase();
        return {
          role:
            tagName.includes("user") || (node as HTMLElement).className.includes("query")
              ? "user"
              : "assistant",
          text: ((node as HTMLElement).textContent ?? "").trim()
        };
      })
      .filter((turn) => turn.text.length > 0) as ConversationSnapshot["turns"];
    return turns.length ? { title: document.title.replace("Gemini", "").trim(), turns } : null;
  },
  getProviderProfile() {
    return GEMINI_PROVIDER_PROFILE;
  }
};
