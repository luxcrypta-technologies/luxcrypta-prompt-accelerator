import type { ChatSurfaceAdapter, ConversationSnapshot, ProviderProfile } from "./types";
import { SNAPSHOT_SOFT_CAP, conversationIdFromUrl } from "./snapshot";
import {
  appendDraftText,
  queryFirstUsableInput,
  readBodyFirstDraftText,
  replaceDraftText,
  type DraftInputElement
} from "./dom";

const INPUT_SELECTORS = [
  "#prompt-textarea",
  "textarea[data-id='root']",
  "textarea",
  "div[contenteditable='true'][data-testid*='prompt']",
  "div[contenteditable='true']"
];

const BODY_SELECTORS = [
  "#prompt-textarea",
  "[data-testid='prompt-textarea']",
  "[data-testid*='composer' i] [contenteditable='true']",
  "form [contenteditable='true']",
  "main [contenteditable='true']",
  "textarea"
];

export const CHATGPT_PROVIDER_PROFILE: ProviderProfile = {
  provider: "chatgpt",
  continuity_style: "assistant_helpful_structure",
  preferred_handoff: "human_readable_review_with_precise_admission",
  capsule_bias: "durable_precision_over_helpful_elaboration",
  risk_profile: [
    "assistant_generated_structure_over_admission",
    "helpful_non_durable_prose",
    "formatting_scaffold_contamination"
  ],
  recommended_runtime_emphasis: [
    "suppress assistant-generated structural text",
    "quarantine helpful prose unless user-promoted",
    "preserve usable review formatting without admitting helper scaffolding"
  ]
};

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
    return readBodyFirstDraftText(queryInput(), BODY_SELECTORS);
  },
  setCurrentDraftText(text: string) {
    return replaceDraftText(queryInput(), text);
  },
  insertText(text: string) {
    return appendDraftText(queryInput(), text);
  },
  getConversationSnapshot(): ConversationSnapshot | null {
    const all = Array.from(document.querySelectorAll("[data-message-author-role]"));
    const considered = all.length > SNAPSHOT_SOFT_CAP ? all.slice(-SNAPSHOT_SOFT_CAP) : all;
    const turns = considered
      .map((node) => {
        const element = node as HTMLElement;
        return {
          role: roleFromDataset(element.dataset.messageAuthorRole),
          text: (element.textContent ?? "").trim()
        };
      })
      .filter((turn) => turn.text);
    if (turns.length === 0) return null;
    const truncated = all.length > SNAPSHOT_SOFT_CAP;
    return {
      title: document.title.replace(" - ChatGPT", ""),
      turns,
      scope: {
        turns_captured: turns.length,
        capture_scope: truncated ? "partial" : "full",
        coverage_confidence: truncated ? "medium" : "high",
        role_attribution: "dom_markers"
      }
    };
  },
  getConversationId(url: string = window.location.href) {
    return conversationIdFromUrl("chatgpt", url);
  },
  getProviderProfile() {
    return CHATGPT_PROVIDER_PROFILE;
  }
};
