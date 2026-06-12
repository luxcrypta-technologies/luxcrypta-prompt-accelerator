import type { ConversationSnapshot } from "./types";

/**
 * Shared conversation-snapshot helpers (Stage 0 rebuild).
 *
 * Replaces the per-adapter `.slice(-12)` + `index % 2` role guess that caused
 * truncated, mis-roled snapshots (defect D0b). Roles are read from real DOM
 * markers; extraction is uncapped but scope-labeled honestly.
 */

export type SnapshotRole = ConversationSnapshot["turns"][number]["role"];

// Soft cap: we no longer hard-slice to 12. We read everything the DOM exposes,
// and only label scope. This is high to avoid losing real history; provider DOM
// virtualization (not this number) is the true ceiling, and we report it.
export const SNAPSHOT_SOFT_CAP = 400;

// The extension mounts its own UI (toolbar + review surface) into the page DOM.
// Those subtrees must never be captured as conversation content — otherwise the
// extension reads its own buttons/labels ("Copy JSON", "Prompt Review",
// "Advanced") back as user turns, producing extension_or_review_chrome_token
// contamination and scaffold-dominant extraction (observed on long, self-
// referential sessions). This guard excludes any node that is, or lives inside,
// the extension's own UI. Identifiers come from content/toolbar-mount.ts.
const EXTENSION_OWN_SELECTOR =
  "#luxcrypta-toolbar, #lcpa-toolbar-root, .lcpa-toolbar-root, [id^='lcpa-'], [class^='lcpa-'], [id^='luxcrypta'], [data-lcpa]";

export function isExtensionOwnNode(node: Element | null): boolean {
  if (!node) return false;
  try {
    const el = node as HTMLElement;
    if (el.id === "luxcrypta-toolbar" || el.id === "lcpa-toolbar-root") return true;
    if (typeof el.closest === "function" && el.closest(EXTENSION_OWN_SELECTOR)) return true;
  } catch {
    return false;
  }
  return false;
}

// Provider navigation chrome — the left-hand conversation-history sidebar — must
// never be captured as conversation content. On providers without a real message
// role marker (notably DeepSeek), broad message-ish selectors otherwise sweep up
// the history list ("Today / <chat title> / Yesterday / <chat title> ...") and it
// becomes the recovered "objective", contaminating the capsule (F1). This guard
// excludes any node that is, or lives inside, a navigation/aside/history region.
const NAV_CHROME_SELECTOR =
  "nav, aside, [role='navigation'], [class*='sidebar' i], [class*='side-bar' i], [class*='history' i], [class*='conversation-list' i], [class*='chat-list' i], [aria-label*='history' i], [aria-label*='sidebar' i]";

// Day-group headers that head a history sidebar list. A captured "turn" whose
// text begins with these (immediately followed by more text, i.e. the
// concatenated chat titles) is the sidebar, not a message.
const SIDEBAR_TEXT_RE =
  /^(today|yesterday|previous\s+7\s+days|previous\s+30\s+days)(?=[A-Z0-9"'])/i;

export function isNavChromeNode(node: Element | null): boolean {
  if (!node) return false;
  try {
    const el = node as HTMLElement;
    if (typeof el.closest === "function" && el.closest(NAV_CHROME_SELECTOR)) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Content-level fallback: true when a string looks like the concatenated history
 * sidebar (day-group header glued directly to chat titles). Used to reject a
 * candidate turn even if structural selectors miss the region.
 */
export function looksLikeSidebarList(text: string): boolean {
  return SIDEBAR_TEXT_RE.test(text.trim());
}

export interface SnapshotScope {
  turns_captured: number;
  capture_scope: "full" | "partial" | "empty";
  coverage_confidence: "high" | "medium" | "low";
  role_attribution: "dom_markers" | "positional_fallback";
}

/**
 * Determine a turn's role from real DOM signals (data attributes, aria, class,
 * tag name), never from alternating position. Returns null when no marker is
 * found so the caller can decide whether to fall back.
 */
export function roleFromMarkers(el: HTMLElement): SnapshotRole | null {
  const marker = [
    el.dataset?.messageAuthorRole,
    el.getAttribute?.("data-message-author-role"),
    el.dataset?.testid,
    el.getAttribute?.("data-testid"),
    el.getAttribute?.("aria-label"),
    el.getAttribute?.("role"),
    el.tagName?.toLowerCase(),
    String(el.className ?? "")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(system|notice|disclaimer)\b/.test(marker)) return "system";
  if (/\b(user|human|you|prompt|query|user-query)\b/.test(marker)) return "user";
  if (
    /\b(assistant|model|response|bot|ai|claude|gpt|gemini|deepseek|grok|model-response)\b/.test(
      marker
    )
  ) {
    return "assistant";
  }
  return null;
}

/**
 * Build a snapshot from a list of message nodes using real role markers, with a
 * positional fallback ONLY when markers are entirely absent. Reports scope so
 * the capsule can state its own coverage truthfully (never claims full when it
 * truncated).
 */
export function buildSnapshotFromNodes(
  nodes: Element[],
  options: { title?: string } = {}
): (ConversationSnapshot & { scope: SnapshotScope }) | null {
  const total = nodes.length;
  if (total === 0) {
    return null;
  }

  // Exclude the extension's own toolbar/review DOM so it is never captured as
  // conversation content (fixes extension_or_review_chrome_token contamination),
  // and exclude provider navigation/history sidebar chrome so the conversation
  // list is never read as turns (fixes F1 objective contamination).
  const conversationNodes = nodes.filter(
    (node) => !isExtensionOwnNode(node) && !isNavChromeNode(node)
  );
  if (conversationNodes.length === 0) {
    return null;
  }

  const considered =
    conversationNodes.length > SNAPSHOT_SOFT_CAP
      ? conversationNodes.slice(-SNAPSHOT_SOFT_CAP)
      : conversationNodes;

  let anyMarker = false;
  const interim = considered.map((node, index) => {
    const el = node as HTMLElement;
    const marked = roleFromMarkers(el);
    if (marked) anyMarker = true;
    return {
      role: marked,
      index,
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim()
    };
  });

  const nodeTurns = interim
    .filter((t) => t.text.length > 0 && !looksLikeSidebarList(t.text))
    .map((t) => ({
      role: (t.role ?? (t.index % 2 === 0 ? "user" : "assistant")) as SnapshotRole,
      text: t.text
    }));

  if (nodeTurns.length === 0) {
    return null;
  }

  // Coalesce consecutive same-role nodes into a single turn. A single message
  // can render across several DOM sub-nodes (paragraphs, code blocks, list
  // items); counting each as a turn inflated turns_captured (e.g. 34/49 for an
  // 8-turn chat). A real turn is a contiguous run of one role. Full text is
  // preserved by joining; only the COUNT changes to reflect true turns.
  const turns: { role: SnapshotRole; text: string }[] = [];
  for (const nodeTurn of nodeTurns) {
    const last = turns[turns.length - 1];
    if (last && last.role === nodeTurn.role) {
      last.text = `${last.text}\n${nodeTurn.text}`.trim();
    } else {
      turns.push({ role: nodeTurn.role, text: nodeTurn.text });
    }
  }

  const truncated = total > SNAPSHOT_SOFT_CAP;
  const scope: SnapshotScope = {
    turns_captured: turns.length,
    capture_scope: truncated ? "partial" : "full",
    coverage_confidence: anyMarker ? (truncated ? "medium" : "high") : "low",
    role_attribution: anyMarker ? "dom_markers" : "positional_fallback"
  };

  return { title: options.title, turns, scope };
}

/**
 * Per-provider conversation id parsed from the URL path. Returns null on the
 * pre-first-message "/new" state (caller holds session in memory until an id
 * appears — agreed first-turn behavior).
 *
 * Patterns (verified):
 *   ChatGPT  chatgpt.com/c/<uuid>
 *   Claude   claude.ai/chat/<uuid>
 *   Gemini   gemini.google.com/app/<id>
 *   DeepSeek chat.deepseek.com/a/chat/s/<id>
 *   Grok     grok.com/chat/<id>
 *   Perplexity perplexity.ai/search/<slug-id>
 */
export function conversationIdFromUrl(provider: string, url: string): string | null {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // use raw url as a last resort
  }

  const pick = (re: RegExp): string | null => {
    const m = path.match(re);
    return m && m[1] ? m[1] : null;
  };

  switch (provider) {
    case "chatgpt":
      return pick(/\/c\/([0-9a-zA-Z-]+)/);
    case "claude":
      return pick(/\/chat\/([0-9a-zA-Z-]+)/);
    case "gemini":
      return pick(/\/app\/([0-9a-zA-Z-]+)/);
    case "deepseek":
      return pick(/\/chat\/s\/([0-9a-zA-Z-]+)/) ?? pick(/\/a\/chat\/([0-9a-zA-Z-]+)/);
    case "grok":
      return pick(/\/chat\/([0-9a-zA-Z-]+)/);
    case "perplexity":
      return pick(/\/search\/([0-9a-zA-Z-]+)/);
    default:
      return null;
  }
}
