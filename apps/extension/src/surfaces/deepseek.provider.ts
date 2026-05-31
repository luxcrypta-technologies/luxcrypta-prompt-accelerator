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

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function roleFromElement(
  element: HTMLElement,
  index: number
): ConversationSnapshot["turns"][number]["role"] {
  const marker = [
    element.dataset.messageAuthorRole,
    element.dataset.testid,
    element.getAttribute("aria-label"),
    String(element.className)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (marker.includes("user") || marker.includes("human")) return "user";
  if (marker.includes("assistant") || marker.includes("deepseek") || marker.includes("response"))
    return "assistant";
  return index % 2 === 0 ? "user" : "assistant";
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
    const input = queryInput();
    const seen = new Set<string>();
    const turns = Array.from(document.querySelectorAll(SNAPSHOT_SELECTORS.join(",")))
      .slice(-SNAPSHOT_SOFT_CAP)
      .map((node, index) => {
        const element = node as HTMLElement;
        if (input && element.contains(input)) return null;
        const text = compactText(element.textContent ?? "").slice(0, 2000);
        if (!text || seen.has(text)) return null;
        seen.add(text);
        return {
          role: roleFromElement(element, index),
          text
        };
      })
      .filter((turn): turn is ConversationSnapshot["turns"][number] => Boolean(turn));

    return turns.length ? { title: document.title.replace("DeepSeek", "").trim(), turns } : null;
  },
  getConversationId(url: string = window.location.href) {
    return conversationIdFromUrl("deepseek", url);
  },
  getProviderProfile() {
    return DEEPSEEK_PROVIDER_PROFILE;
  }
};
