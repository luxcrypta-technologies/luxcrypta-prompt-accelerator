export type DraftInputElement = HTMLElement | HTMLTextAreaElement;

function isVisible(element: Element): boolean {
  const html = element as HTMLElement;
  const style = window.getComputedStyle(html);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function isEditable(element: Element): element is DraftInputElement {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (!(element instanceof HTMLElement)) return false;
  return element.isContentEditable || element.getAttribute("contenteditable") === "true";
}

export function queryFirstUsableInput(selectors: string[]): DraftInputElement | null {
  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll(selector));
    const usable = elements.find((element): element is DraftInputElement => isEditable(element) && isVisible(element));
    if (usable) return usable;
  }
  return null;
}

export function readDraftText(element: DraftInputElement | null): string {
  if (!element) return "";
  return element instanceof HTMLTextAreaElement ? element.value : element.textContent ?? "";
}

function dispatchDraftEvents(element: DraftInputElement, text: string): void {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function replaceDraftText(element: DraftInputElement | null, text: string): boolean {
  if (!element) return false;
  element.focus();
  if (element instanceof HTMLTextAreaElement) {
    element.value = text;
  } else {
    element.replaceChildren(document.createTextNode(text));
  }
  dispatchDraftEvents(element, text);
  return readDraftText(element).trim() === text.trim();
}

export function appendDraftText(element: DraftInputElement | null, text: string): boolean {
  const current = readDraftText(element).trimEnd();
  return replaceDraftText(element, current ? `${current}\n${text}` : text);
}
