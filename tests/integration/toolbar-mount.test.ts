import { describe, expect, it, vi } from "vitest";
import { createToolbarMountController, TOOLBAR_ID, TOOLBAR_ROOT_ID } from "@/content/toolbar-mount";
import type { ChatSurfaceAdapter } from "@/types/surfaces";

function surface(ready = true): ChatSurfaceAdapter {
  return {
    id: "chatgpt",
    label: "ChatGPT",
    matches: () => true,
    isReady: () => ready,
    getInputElement: () => document.querySelector("[data-input]"),
    getCurrentDraftText: () => "",
    setCurrentDraftText: () => true,
    insertText: () => true
  };
}

function controller(activeSurface: ChatSurfaceAdapter | null, onAdvanced = vi.fn()) {
  return createToolbarMountController({
    getSurface: () => activeSurface,
    onAdvanced,
    observeDom: () => () => undefined
  });
}

function surfaceFor(id: string, selector: string): ChatSurfaceAdapter {
  return {
    id,
    label: id,
    matches: () => true,
    isReady: () => document.querySelector(selector) !== null,
    getInputElement: () => document.querySelector(selector),
    getCurrentDraftText: () => "",
    setCurrentDraftText: () => true,
    insertText: () => true
  };
}

describe("toolbar mount controller", () => {
  function stubRect(element: Element, rect: Partial<DOMRect>) {
    element.getBoundingClientRect = () =>
      ({
        x: rect.left ?? 0,
        y: rect.top ?? 0,
        left: rect.left ?? 0,
        top: rect.top ?? 0,
        right: rect.right ?? 0,
        bottom: rect.bottom ?? 0,
        width: rect.width ?? Math.max(0, (rect.right ?? 0) - (rect.left ?? 0)),
        height: rect.height ?? Math.max(0, (rect.bottom ?? 0) - (rect.top ?? 0)),
        toJSON: () => ({})
      }) as DOMRect;
  }

  it("mounts in an extension-owned root and dedupes repeated ensures", () => {
    document.body.innerHTML = `<main><div data-input></div></main>`;
    const mount = controller(surface());

    mount.ensureToolbarMounted();
    mount.ensureToolbarMounted();

    expect(document.querySelectorAll(`#${TOOLBAR_ROOT_ID}`)).toHaveLength(1);
    expect(document.querySelectorAll(`#${TOOLBAR_ID}`)).toHaveLength(1);
    expect(document.getElementById(TOOLBAR_ID)?.parentElement?.id).toBe(TOOLBAR_ROOT_ID);
    expect(document.getElementById(TOOLBAR_ROOT_ID)?.nextElementSibling).toBe(document.querySelector("[data-input]"));
  });

  it("reattaches automatically when ChatGPT removes the toolbar node", () => {
    document.body.innerHTML = `<main><div data-input></div></main>`;
    const mount = controller(surface());

    mount.ensureToolbarMounted();
    document.getElementById(TOOLBAR_ID)?.remove();
    expect(mount.isToolbarPresent()).toBe(false);

    mount.ensureToolbarMounted();

    expect(mount.isToolbarPresent()).toBe(true);
    expect(document.querySelectorAll(`#${TOOLBAR_ID}`)).toHaveLength(1);
  });

  it("removes duplicate toolbar nodes before preserving the canonical instance", () => {
    document.body.innerHTML = `
      <div id="${TOOLBAR_ROOT_ID}"><div id="${TOOLBAR_ID}" class="lcpa-toolbar"></div></div>
      <div class="lcpa-toolbar"></div>
      <div id="${TOOLBAR_ID}" class="lcpa-toolbar"></div>
    `;
    const mount = controller(surface());

    mount.ensureToolbarMounted();

    expect(document.querySelectorAll(".lcpa-toolbar")).toHaveLength(1);
    expect(document.querySelectorAll(`#${TOOLBAR_ID}`)).toHaveLength(1);
    expect(document.getElementById(TOOLBAR_ID)?.parentElement?.id).toBe(TOOLBAR_ROOT_ID);
  });

  it("does not mount when the current surface is not ready", () => {
    document.body.innerHTML = `<main></main>`;
    const mount = controller(surface(false));

    mount.ensureToolbarMounted();

    expect(document.getElementById(TOOLBAR_ID)).toBeNull();
  });

  it("keeps the toolbar in the prior composer host so ChatGPT supplies the background", () => {
    document.body.innerHTML = `<main><div data-input></div></main>`;
    const input = document.querySelector("[data-input]");
    if (!input) throw new Error("Input fixture missing.");
    stubRect(input, { left: 540, top: 940, right: 1310, bottom: 990, width: 770, height: 50 });
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1600 });
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 1100 });
    const mount = controller(surface());

    mount.ensureToolbarMounted();
    const toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) throw new Error("Toolbar fixture missing.");
    stubRect(toolbar, { left: 0, top: 0, right: 238, bottom: 42, width: 238, height: 42 });
    mount.positionToolbar();
    const root = document.getElementById(TOOLBAR_ROOT_ID);

    expect(root?.dataset.placement).toBe("composer-inline");
    expect(root?.style.top).toBe("");
    expect(root?.style.left).toBe("");
    expect(root?.style.bottom).toBe("");
    expect(root?.parentElement).toBe(input.parentElement);
    expect(root?.nextElementSibling).toBe(input);
  });

  it("rebinds an existing toolbar when the active provider root changes", () => {
    document.body.innerHTML = `
      <main>
        <section id="chatgpt-root"><div data-chatgpt-input></div></section>
        <section id="claude-root"><div data-claude-input></div></section>
      </main>
    `;
    let activeSurface = surfaceFor("chatgpt", "[data-chatgpt-input]");
    const onAdvanced = vi.fn();
    const mount = createToolbarMountController({
      getSurface: () => activeSurface,
      onAdvanced,
      observeDom: () => () => undefined
    });

    mount.ensureToolbarMounted();
    const toolbar = document.getElementById(TOOLBAR_ID);
    const button = toolbar?.querySelector("button");
    if (!toolbar || !button) throw new Error("Toolbar fixture missing.");
    button.onclick = null;
    toolbar.dataset.listenerBound = "true";
    activeSurface = surfaceFor("claude", "[data-claude-input]");

    mount.ensureToolbarMounted();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.getElementById(TOOLBAR_ROOT_ID)?.dataset.surface).toBe("claude");
    expect(document.getElementById(TOOLBAR_ROOT_ID)?.parentElement?.id).toBe("claude-root");
    expect(onAdvanced).toHaveBeenCalledWith(activeSurface);
  });
});
