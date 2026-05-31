import type { ChatSurfaceAdapter, ConversationSnapshot, ProviderProfile } from "./types";
import { buildSnapshotFromNodes, conversationIdFromUrl } from "./snapshot";
import {
  appendDraftText,
  queryFirstUsableInput,
  readBodyFirstDraftText,
  replaceDraftText,
  type DraftInputElement
} from "./dom";

const INPUT_SELECTORS = [
  "div.ProseMirror[contenteditable='true']",
  "[contenteditable='true'][aria-label*='message' i]",
  "textarea",
  "div[contenteditable='true']"
];

const BODY_SELECTORS = [
  "div.ProseMirror[contenteditable='true']",
  "[data-testid*='composer' i] [contenteditable='true']",
  "form [contenteditable='true']",
  "main [contenteditable='true']",
  "textarea"
];

export const CLAUDE_PROVIDER_PROFILE: ProviderProfile = {
  provider: "claude",
  continuity_style: "framing_resistant_analysis",
  preferred_handoff: "user_structure_preserved_with_meta_filtered",
  capsule_bias: "separate_framing_resistance_from_state",
  risk_profile: [
    "meta_refusal_contamination",
    "role_framing_resistance",
    "user_structure_over_pruning"
  ],
  recommended_runtime_emphasis: [
    "distinguish framing resistance from state content",
    "quarantine meta refusal text",
    "preserve user-authored structure even when the model resists role framing"
  ]
};

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
    return readBodyFirstDraftText(queryInput(), BODY_SELECTORS);
  },
  setCurrentDraftText(text: string) {
    return replaceDraftText(queryInput(), text);
  },
  insertText(text: string) {
    return appendDraftText(queryInput(), text);
  },
  getConversationSnapshot(): ConversationSnapshot | null {
    const nodes = Array.from(
      document.querySelectorAll(
        "[data-testid*='message'], [data-test-render-count] [data-testid], div[class*='font-claude'], article, [class*='message']"
      )
    );
    return buildSnapshotFromNodes(nodes, {
      title: document.title.replace("Claude", "").trim()
    });
  },
  getConversationId(url: string = window.location.href) {
    return conversationIdFromUrl("claude", url);
  },
  getProviderProfile() {
    return CLAUDE_PROVIDER_PROFILE;
  }
};
