import type { ChatSurfaceAdapter, ConversationSnapshot, ProviderProfile } from "./types";
import { buildSnapshotFromNodes, conversationIdFromUrl, isNavChromeNode } from "./snapshot";
import {
  appendDraftText,
  queryFirstUsableInput,
  readBodyFirstDraftText,
  replaceDraftText,
  type DraftInputElement
} from "./dom";

const INPUT_SELECTORS = [
  "textarea[data-testid*='chat' i]",
  "textarea[data-testid*='input' i]",
  "[data-testid*='chat' i] textarea",
  "[data-testid*='input' i] textarea",
  "textarea[placeholder*='message' i]",
  "textarea[placeholder*='ask' i]",
  "textarea[aria-label*='message' i]",
  "textarea[aria-label*='ask' i]",
  "textarea[aria-label*='deepseek' i]",
  "[contenteditable='true'][role='textbox']",
  "[contenteditable='true'][aria-label*='message' i]",
  "[contenteditable='true'][aria-label*='ask' i]",
  "[contenteditable='true'][aria-label*='deepseek' i]",
  "div.ProseMirror[contenteditable='true']",
  "textarea"
];

const BODY_SELECTORS = [
  "[data-testid*='chat' i] textarea",
  "[data-testid*='input' i] textarea",
  "[data-testid*='composer' i] textarea",
  "[contenteditable='true'][role='textbox']",
  "div.ProseMirror[contenteditable='true']",
  "main textarea",
  "main [contenteditable='true']",
  "textarea"
];

const SNAPSHOT_SELECTORS = [
  "[data-message-author-role]",
  "[data-testid*='message' i]",
  // DeepSeek live DOM (observed in inspector): assistant content renders as
  // .ds-markdown-paragraph inside .ds-scroll-area containers; there is no
  // data-message-author-role. Target the observed ds- structure, with a
  // generic fallback for the user-turn container.
  ".ds-markdown",
  ".ds-markdown-paragraph",
  "[class*='ds-scroll-area' i]",
  "[class*='message' i]",
  "article"
];

export const DEEPSEEK_PROVIDER_PROFILE: ProviderProfile = {
  provider: "deepseek",
  continuity_style: "structured_reasoning",
  preferred_handoff: "compact_markdown_or_json",
  capsule_bias: "schema_strict",
  risk_profile: [
    "over_compression",
    "loss_of_open_state",
    "rigid_reconstruction",
    "literal_prompt_scaffolding",
    "fused_governance_blocks"
  ],
  recommended_runtime_emphasis: [
    "preserve hierarchical reasoning structure",
    "preserve conflict taxonomy and mutation targets",
    "preserve quarantine, defer, and reject distinctions",
    "preserve unresolved tensions explicitly",
    "do not over-collapse ambiguity",
    "keep rejected directions distinct from governance principles and invariants",
    "validate reconstruction fidelity"
  ]
};

function queryInput(): DraftInputElement | null {
  return queryFirstUsableInput(INPUT_SELECTORS);
}

function matchesDeepSeekUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname === "chat.deepseek.com") return true;
    return (
      (parsed.hostname === "deepseek.com" || parsed.hostname === "www.deepseek.com") &&
      parsed.pathname.startsWith("/chat")
    );
  } catch {
    return false;
  }
}

export const deepseekSurface: ChatSurfaceAdapter = {
  id: "deepseek",
  label: "DeepSeek",
  matches: matchesDeepSeekUrl,
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
    // Scope to the conversation region (main) and exclude the input composer.
    // DeepSeek exposes no data-message-author-role, so we hand the candidate
    // message nodes to the shared builder, which applies the extension-own-node
    // AND nav/history-sidebar exclusions (fixing F1: the left-hand chat-history
    // list was being read as turns and became the contaminated objective),
    // derives roles from real markers with a positional fallback, and reports
    // capture scope honestly.
    const root =
      document.querySelector("main") ??
      document.querySelector("[class*='ds-scroll-area' i]") ??
      document.body;
    const scope: ParentNode = root ?? document;
    const nodes = Array.from(
      scope.querySelectorAll(SNAPSHOT_SELECTORS.join(","))
    ).filter((node) => !isNavChromeNode(node));
    return buildSnapshotFromNodes(nodes, {
      title: document.title.replace("DeepSeek", "").trim()
    });
  },
  getConversationId(url: string = window.location.href) {
    return conversationIdFromUrl("deepseek", url);
  },
  getProviderProfile() {
    return DEEPSEEK_PROVIDER_PROFILE;
  }
};
