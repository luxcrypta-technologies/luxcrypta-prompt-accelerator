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
  "textarea[data-testid*='ask' i]",
  "textarea[data-testid*='search' i]",
  "[data-testid*='composer' i] textarea",
  "[data-testid*='ask' i] textarea",
  "[data-testid*='search' i] textarea",
  "textarea[placeholder*='ask' i]",
  "textarea[placeholder*='follow' i]",
  "textarea[aria-label*='ask' i]",
  "textarea[aria-label*='search' i]",
  "[contenteditable='true'][role='textbox'][aria-label*='ask' i]",
  "[contenteditable='true'][role='textbox'][aria-label*='search' i]",
  "[data-testid*='composer' i] [contenteditable='true']",
  "[contenteditable='true'][role='textbox']",
  "div.ProseMirror[contenteditable='true']",
  "textarea"
];

const THREAD_SELECTORS = [
  "[data-message-author-role]",
  "[data-testid*='query' i]",
  "[data-testid*='answer' i]",
  "[data-testid*='message' i]",
  "article"
];

const SOURCE_SELECTORS = [
  "[data-testid*='source' i]",
  "[data-testid*='citation' i]",
  "[aria-label*='source' i]",
  "[aria-label*='citation' i]",
  "[class*='source' i]",
  "[class*='citation' i]"
];

const BODY_SELECTORS = [
  "[data-testid*='composer' i]",
  "[data-testid*='query' i]",
  "[data-testid*='ask' i]",
  "[role='textbox']",
  "main textarea",
  "main [contenteditable='true']",
  "textarea",
  "[contenteditable='true']"
];

export const PERPLEXITY_PROVIDER_PROFILE: ProviderProfile = {
  provider: "perplexity",
  continuity_style: "retrieval_governed",
  preferred_handoff: "human_readable_with_stable_state_first",
  capsule_bias: "source_contamination_resistant",
  risk_profile: [
    "retrieval_contamination",
    "citation_confidence_bias",
    "external_context_overriding_stable_state",
    "unresolved_state_collapse",
    "page_chrome_contamination",
    "over_pruning_structured_prompt_body"
  ],
  recommended_runtime_emphasis: [
    "prioritize real user-authored draft body over page chrome",
    "strip UI and retrieval scaffolding before state admission",
    "separate retrieved information from stable workflow state",
    "treat external sources as provisional or quarantine unless explicitly promoted",
    "preserve unresolved questions even when search provides partial answers",
    "detect conflict between retrieved content and Stable State"
  ],
  retrieved_content_default_state: "provisional_or_quarantine"
};

function queryInput(): DraftInputElement | null {
  return queryFirstUsableInput(INPUT_SELECTORS);
}

function compactText(value: string): string {
  return value
    .replace(/[\t\r\n\f\v]+/g, " ")
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUiArtifactText(value: string): boolean {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return /^(showmore|showless|showmoreshowless|copied|copylink|share|rewrite|sources|related|askfollowup|thread|library|discover|home|upgrade|signin|trypro|perplexity)$/.test(
    clean
  );
}

function stripUiLines(value: string): string {
  return value
    .replace(/show more\s*show less/gi, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !isUiArtifactText(line))
    .join("\n")
    .trim();
}

function looksLikeStructuredDraft(value: string): boolean {
  return /\b(objective|stable core|trusted state|hard requirements?|requirements?|governance principles?|invariants?|continuity safeguards?|rejected directions?|open questions?|carry[-\s]?forward capsule)\s*:/i.test(
    value
  );
}

function bodyFirstDraftText(input: DraftInputElement | null): string {
  const direct = stripUiLines(readBodyFirstDraftText(input, BODY_SELECTORS));
  if (direct.length >= 12 && !isUiArtifactText(direct)) {
    return direct;
  }

  const candidates = Array.from(document.querySelectorAll(BODY_SELECTORS.join(",")))
    .map((node) => {
      const element = node as HTMLElement;
      if (input && element !== input && element.contains(input)) return "";
      return stripUiLines(
        element instanceof HTMLTextAreaElement
          ? element.value
          : element.innerText || element.textContent || ""
      );
    })
    .filter((text) => text.length >= 12 && !isUiArtifactText(text))
    .sort((left, right) => {
      const leftScore = (looksLikeStructuredDraft(left) ? 10000 : 0) + left.length;
      const rightScore = (looksLikeStructuredDraft(right) ? 10000 : 0) + right.length;
      return rightScore - leftScore;
    });

  return candidates[0] ?? direct;
}

function matchesPerplexityUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "perplexity.ai" || parsed.hostname === "www.perplexity.ai")
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

  if (marker.includes("query") || marker.includes("user") || marker.includes("ask")) return "user";
  if (marker.includes("answer") || marker.includes("assistant") || marker.includes("response"))
    return "assistant";
  return index % 2 === 0 ? "user" : "assistant";
}

function userQueryTurns(seen: Set<string>): ConversationSnapshot["turns"] {
  const turns: ConversationSnapshot["turns"] = [];
  // Perplexity renders each user question as a prominent heading above its
  // answer (typically an h1/h2 with a group/query container). Collect those in
  // document order so multi-question threads keep all user turns.
  const headingNodes = Array.from(
    document.querySelectorAll(
      "[class*='query' i] h1, [class*='query' i] h2, h1[class*='query' i], main h1, [data-testid*='query' i]"
    )
  );
  for (const node of headingNodes.slice(-SNAPSHOT_SOFT_CAP)) {
    const element = node as HTMLElement;
    const text = stripUiLines(compactText(element.textContent ?? "")).slice(0, 2000);
    if (!text || isUiArtifactText(text) || seen.has(text)) continue;
    seen.add(text);
    turns.push({ role: "user", text });
  }
  // Fallback: if no query heading was found, the page <title> on a Perplexity
  // search is the user's question. Use it so there is always a user-authored
  // objective rather than only retrieved citations.
  if (turns.length === 0) {
    const titleText = stripUiLines(
      compactText(document.title.replace(/\s*[-|]\s*Perplexity.*$/i, ""))
    ).slice(0, 2000);
    if (titleText && !isUiArtifactText(titleText) && !seen.has(titleText)) {
      seen.add(titleText);
      turns.push({ role: "user", text: titleText });
    }
  }
  return turns;
}

function sourceTurns(
  input: DraftInputElement | null,
  seen: Set<string>
): ConversationSnapshot["turns"] {
  const turns: ConversationSnapshot["turns"] = [];
  for (const node of Array.from(document.querySelectorAll(SOURCE_SELECTORS.join(","))).slice(-8)) {
    const element = node as HTMLElement;
    if (input && element.contains(input)) continue;
    const text = stripUiLines(compactText(element.textContent ?? "")).slice(0, 1600);
    if (!text || isUiArtifactText(text) || seen.has(text)) continue;
    seen.add(text);
    turns.push({
      role: "unknown",
      text: `Retrieved evidence (provisional): ${text}`
    });
  }
  return turns;
}

export const perplexitySurface: ChatSurfaceAdapter = {
  id: "perplexity",
  label: "Perplexity",
  matches: matchesPerplexityUrl,
  isReady() {
    return queryInput() !== null;
  },
  getInputElement: queryInput,
  getCurrentDraftText() {
    return bodyFirstDraftText(queryInput());
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
    const turns = Array.from(document.querySelectorAll(THREAD_SELECTORS.join(",")))
      .slice(-SNAPSHOT_SOFT_CAP)
      .map((node, index) => {
        const element = node as HTMLElement;
        if (input && element.contains(input)) return null;
        const text = stripUiLines(compactText(element.textContent ?? "")).slice(0, 2000);
        if (!text || isUiArtifactText(text) || seen.has(text)) return null;
        seen.add(text);
        return {
          role: roleFromElement(element, index),
          text
        };
      })
      .filter((turn): turn is ConversationSnapshot["turns"][number] => Boolean(turn));

    // Perplexity is a search surface, not a chat app: the user's question is
    // not rendered as a message bubble — it lives in the page <title> and the
    // query heading(s). Without this, capture finds only retrieved citations
    // (which are correctly quarantined), leaving no user-authored objective.
    // Prepend the user's actual query as a user-role turn.
    const userQueries = userQueryTurns(seen);

    const retrieved = sourceTurns(input, seen);
    const combined = [...userQueries, ...turns, ...retrieved];
    return combined.length
      ? { title: document.title.replace("Perplexity", "").trim(), turns: combined }
      : null;
  },
  getConversationId(url: string = window.location.href) {
    return conversationIdFromUrl("perplexity", url);
  },
  getProviderProfile() {
    return PERPLEXITY_PROVIDER_PROFILE;
  }
};
