export type DraftInputElement = HTMLElement | HTMLTextAreaElement;

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
