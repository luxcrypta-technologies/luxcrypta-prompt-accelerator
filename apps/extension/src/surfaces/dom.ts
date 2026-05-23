export type DraftInputElement = HTMLElement | HTMLTextAreaElement;

const UI_TEXT_RE =
  /^(?:show more|show less|show more show less|copy|copied|copy json|copy raw|copy link|copy all review|copy review \+ raw json|copy engineering summary|copy portable capsule|copy workflow export|prompt review|advanced|retry open|review opened|opening review|review did not open|apply|save|save workflow|save capsule|download|download json|export|share|rewrite|sources?|citations?|related|ask follow-?up|thread|library|discover|home|settings|sign in|login|logout|upgrade|try pro|new chat)$/i;

function isVisible(element: Element): boolean {
  const html = element as HTMLElement;
  const style = window.getComputedStyle(html);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    !html.hasAttribute("hidden")
  );
}

function isEditable(element: Element): element is DraftInputElement {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (!(element instanceof HTMLElement)) return false;
  return element.isContentEditable || element.getAttribute("contenteditable") === "true";
}

export function queryFirstUsableInput(selectors: string[]): DraftInputElement | null {
  const active = document.activeElement;
  if (active && isEditable(active) && isVisible(active)) return active;

  const ranked: DraftInputElement[] = [];
  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll(selector));
    const usable = elements.filter(
      (element): element is DraftInputElement => isEditable(element) && isVisible(element)
    );
    ranked.push(...usable);
  }
  const unique = Array.from(new Set(ranked));
  return (
    unique.sort((left, right) => {
      const leftScore = inputRank(left);
      const rightScore = inputRank(right);
      return rightScore - leftScore;
    })[0] ?? null
  );
}

export function readDraftText(element: DraftInputElement | null): string {
  if (!element) return "";
  return element instanceof HTMLTextAreaElement ? element.value : element.innerText || element.textContent || "";
}

function compactUiKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function isProviderChromeText(value: string): boolean {
  const clean = value.trim();
  if (!clean) return true;
  const compact = compactUiKey(clean);
  return (
    UI_TEXT_RE.test(clean) ||
    /^(showmore|showless|showmoreshowless|copyjson|copyraw|promptreview|retryopen|reviewopened|openingreview|reviewdidnotopen|trypro|newchat|askfollowup)$/.test(
      compact
    )
  );
}

export function stripProviderChromeLines(value: string): string {
  return value
    .replace(/\b(show more)\s*(show less)\b/gi, "\n")
    .replace(/\b(Copy JSON|Copy Raw|Copy All Review|Copy Review \+ Raw JSON|Copy Engineering Summary|Copy Portable Capsule|Copy Workflow Export|Prompt Review|Retry Open)\b/gi, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !isProviderChromeText(line))
    .join("\n")
    .trim();
}

function elementText(element: Element): string {
  return element instanceof HTMLTextAreaElement
    ? element.value
    : (element as HTMLElement).innerText || element.textContent || "";
}

function looksLikePromptBody(value: string): boolean {
  return /\b(objective|mission|stable core|trusted state|hard requirements?|requirements?|governance principles?|invariants?|continuity safeguards?|rejected directions?|open questions?|open tensions?|unresolved tensions?|carry[-\s]?forward capsule|do not|must|preserve)\b/i.test(
    value
  );
}

function bodyScore(value: string, active: boolean): number {
  const clean = stripProviderChromeLines(value);
  if (!clean || isProviderChromeText(clean)) return -100;
  const lines = clean.split(/\n+/).filter(Boolean);
  const uiLines = lines.filter(isProviderChromeText).length;
  const uiRatio = lines.length ? uiLines / lines.length : 1;
  let score = Math.min(40, clean.length / 12);
  if (looksLikePromptBody(clean)) score += 80;
  if (active) score += 25;
  score -= uiRatio * 90;
  if (/assistant|model response|sources?|citations?/i.test(clean) && !looksLikePromptBody(clean)) {
    score -= 20;
  }
  return score;
}

export function readBodyFirstDraftText(
  input: DraftInputElement | null,
  bodySelectors: string[] = []
): string {
  const direct = stripProviderChromeLines(readDraftText(input));
  if (direct.length >= 4 && !isProviderChromeText(direct)) {
    return direct;
  }

  const selectors = Array.from(
    new Set([
      ...bodySelectors,
      "[data-testid*='composer' i] textarea",
      "[data-testid*='composer' i] [contenteditable='true']",
      "[data-testid*='prompt' i]",
      "[role='textbox']",
      "main textarea",
      "main [contenteditable='true']",
      "textarea",
      "[contenteditable='true']"
    ])
  );

  const candidates = Array.from(document.querySelectorAll(selectors.join(",")))
    .filter((element): element is DraftInputElement => isEditable(element) && isVisible(element))
    .map((element) => ({
      text: stripProviderChromeLines(elementText(element)),
      score: bodyScore(elementText(element), element === input || element === document.activeElement)
    }))
    .filter((candidate) => candidate.text.length >= 4 && !isProviderChromeText(candidate.text))
    .sort((left, right) => right.score - left.score || right.text.length - left.text.length);

  return candidates[0]?.text ?? direct;
}

function dispatchDraftEvents(element: DraftInputElement, text: string): void {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function inputRank(element: DraftInputElement): number {
  const marker = [
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.getAttribute("data-testid"),
    element.id,
    element.className
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let score = 0;
  if (document.activeElement === element) score += 20;
  if (/ask|message|prompt|composer|chat|search|input/.test(marker)) score += 10;
  if (/hidden|mirror|clone|preview|decoy/.test(marker)) score -= 20;
  if (element instanceof HTMLTextAreaElement) score += 4;
  if (element.isContentEditable) score += 3;
  score += Math.min(6, readDraftText(element).length / 80);
  return score;
}

function setTextareaValue(element: HTMLTextAreaElement, text: string): void {
  const prototype = Object.getPrototypeOf(element) as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) {
    setter.call(element, text);
  } else {
    element.value = text;
  }
}

function setContentEditableText(element: HTMLElement, text: string): void {
  element.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const inserted = document.execCommand?.("insertText", false, text);
  if (!inserted || readDraftText(element).trim() !== text.trim()) {
    element.replaceChildren(document.createTextNode(text));
  }
}

function normalizeForVerify(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+\n/g, "\n").trim();
}

export function replaceDraftText(element: DraftInputElement | null, text: string): boolean {
  if (!element) return false;
  element.focus();
  if (element instanceof HTMLTextAreaElement) {
    setTextareaValue(element, text);
  } else {
    setContentEditableText(element, text);
  }
  dispatchDraftEvents(element, text);
  return normalizeForVerify(readDraftText(element)) === normalizeForVerify(text);
}

export function appendDraftText(element: DraftInputElement | null, text: string): boolean {
  const current = readDraftText(element).trimEnd();
  return replaceDraftText(element, current ? `${current}\n${text}` : text);
}
