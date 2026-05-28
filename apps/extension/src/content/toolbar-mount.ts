import { bindToolbarHandlers, createToolbarElement } from "./toolbar-entry";
import type { ChatSurfaceAdapter } from "@/types/surfaces";

export const TOOLBAR_ROOT_ID = "lcpa-toolbar-root";
export const TOOLBAR_ID = "luxcrypta-toolbar";
const TOOLBAR_CLASS = "lcpa-toolbar";

interface ToolbarMountControllerDeps {
  getSurface: () => ChatSurfaceAdapter | null;
  onAdvanced: (surface: ChatSurfaceAdapter) => Promise<void> | void;
  observeDom: (onChange: () => void) => () => void;
}

export interface ToolbarMountController {
  ensureToolbarMounted: () => void;
  isToolbarPresent: () => boolean;
  mountToolbar: () => void;
  positionToolbar: () => void;
  removeDuplicateToolbars: () => void;
  observeChatGPTNavigationChanges: () => () => void;
  observeRootContainerReplacement: () => () => void;
  startToolbarHealthMonitor: () => () => void;
  stop: () => void;
}

function readySurface(surface: ChatSurfaceAdapter | null): ChatSurfaceAdapter | null {
  return surface?.isReady() ? surface : null;
}

export function createToolbarMountController(
  deps: ToolbarMountControllerDeps
): ToolbarMountController {
  const cleanupCallbacks: Array<() => void> = [];
  let lastUrl = window.location.href;

  function toolbarHost(surface: ChatSurfaceAdapter | null): HTMLElement | null {
    const input = surface?.getInputElement();
    return input?.parentElement ?? null;
  }

  function fallbackToolbarPlacement(root: HTMLElement): void {
    root.style.left = "";
    root.style.top = "";
    root.style.right = "";
    root.style.bottom = "";
    root.dataset.placement = "fallback";
  }

  function positionToolbar(): void {
    const root = document.getElementById(TOOLBAR_ROOT_ID);
    const toolbar = document.getElementById(TOOLBAR_ID);
    const surface = readySurface(deps.getSurface());
    if (!root || !toolbar || !surface) {
      if (root) fallbackToolbarPlacement(root);
      return;
    }

    const host = toolbarHost(surface);
    if (host && root.parentElement === host) {
      root.style.left = "";
      root.style.top = "";
      root.style.right = "";
      root.style.bottom = "";
      root.dataset.placement = "composer-inline";
      return;
    }

    const input = surface.getInputElement();
    if (!input) {
      fallbackToolbarPlacement(root);
      return;
    }

    const inputRect = input.getBoundingClientRect();
    if (!inputRect.width && !inputRect.height) {
      fallbackToolbarPlacement(root);
      return;
    }

    const toolbarRect = toolbar.getBoundingClientRect();
    const toolbarWidth = Math.max(toolbarRect.width, 232);
    const toolbarHeight = Math.max(toolbarRect.height, 42);
    const margin = 12;
    const gap = 10;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const maxLeft = Math.max(margin, viewportWidth - toolbarWidth - margin);
    const left = Math.min(Math.max(inputRect.left, margin), maxLeft);
    const preferredTop = inputRect.top - toolbarHeight - gap;
    const lowerTop = inputRect.bottom + gap;
    const top =
      preferredTop >= margin
        ? preferredTop
        : lowerTop + toolbarHeight <= viewportHeight - margin
          ? lowerTop
          : Math.max(margin, viewportHeight - toolbarHeight - margin);

    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
    root.dataset.placement = "composer-overlay";
  }

  function getOrCreateLuxcryptaRoot(surface: ChatSurfaceAdapter | null): HTMLElement | null {
    const body = document.body;
    if (!body) return null;

    const host = toolbarHost(surface);
    const roots = Array.from(document.querySelectorAll<HTMLElement>(`#${TOOLBAR_ROOT_ID}`));
    const root = roots.find((candidate) => !candidate.classList.contains(TOOLBAR_CLASS)) ?? null;
    for (const duplicate of roots) {
      if (duplicate !== root) {
        duplicate.remove();
      }
    }
    if (root) {
      root.classList.add("lcpa-toolbar-root");
      if (host && root.parentElement !== host) {
        const input = surface?.getInputElement();
        host.insertBefore(root, input ?? host.firstChild);
      }
      return root;
    }

    const nextRoot = document.createElement("div");
    nextRoot.id = TOOLBAR_ROOT_ID;
    nextRoot.className = "lcpa-toolbar-root";
    nextRoot.setAttribute("data-luxcrypta-owned", "true");
    if (host) {
      const input = surface?.getInputElement();
      host.insertBefore(nextRoot, input ?? host.firstChild);
    } else {
      body.append(nextRoot);
    }
    return nextRoot;
  }

  function removeDuplicateToolbars(): void {
    const toolbars = Array.from(
      document.querySelectorAll<HTMLElement>(`.${TOOLBAR_CLASS}, #${TOOLBAR_ID}`)
    );
    const canonical =
      toolbars.find(
        (toolbar) => toolbar.id === TOOLBAR_ID && toolbar.parentElement?.id === TOOLBAR_ROOT_ID
      ) ??
      toolbars.find((toolbar) => toolbar.id === TOOLBAR_ID) ??
      toolbars[0];

    for (const toolbar of toolbars) {
      if (toolbar !== canonical) {
        toolbar.remove();
      }
    }

    if (canonical) {
      canonical.id = TOOLBAR_ID;
    }
  }

  function isToolbarPresent(): boolean {
    const toolbar = document.getElementById(TOOLBAR_ID);
    return Boolean(toolbar?.isConnected);
  }

  function mountToolbar(): void {
    const surface = readySurface(deps.getSurface());
    if (!surface) return;

    const root = getOrCreateLuxcryptaRoot(surface);
    if (!root) return;

    const existing = document.getElementById(TOOLBAR_ID);
    const handlers = {
      onAdvanced: async () => {
        const activeSurface = readySurface(deps.getSurface());
        if (!activeSurface) {
          throw new Error("No ready provider surface detected.");
        }
        if (document.getElementById(TOOLBAR_ROOT_ID)?.dataset.surface !== activeSurface.id) {
          mountToolbar();
        }
        await deps.onAdvanced(activeSurface);
      }
    };
    if (existing) {
      if (existing.parentElement !== root) {
        root.append(existing);
      }
      root.dataset.mountStatus =
        existing.dataset.listenerBound === "true" ? "mounted" : "rebinding";
      bindToolbarHandlers(existing, handlers);
      root.dataset.surface = surface.id;
      positionToolbar();
      return;
    }

    const toolbar = createToolbarElement(handlers);
    toolbar.id = TOOLBAR_ID;
    root.dataset.surface = surface.id;
    root.dataset.mountStatus = "mounted";
    root.append(toolbar);
    positionToolbar();
    window.requestAnimationFrame(positionToolbar);
  }

  function ensureToolbarMounted(): void {
    removeDuplicateToolbars();
    if (isToolbarPresent()) {
      if (readySurface(deps.getSurface())) {
        mountToolbar();
      } else {
        positionToolbar();
      }
      return;
    }
    mountToolbar();
  }

  function observeChatGPTNavigationChanges(): () => void {
    const handleNavigation = () => {
      if (lastUrl !== window.location.href) {
        lastUrl = window.location.href;
      }
      ensureToolbarMounted();
    };

    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("hashchange", handleNavigation);
    window.addEventListener("resize", handleNavigation);
    window.addEventListener("scroll", handleNavigation, true);
    const interval = window.setInterval(handleNavigation, 750);

    const cleanup = () => {
      window.removeEventListener("popstate", handleNavigation);
      window.removeEventListener("hashchange", handleNavigation);
      window.removeEventListener("resize", handleNavigation);
      window.removeEventListener("scroll", handleNavigation, true);
      window.clearInterval(interval);
    };
    cleanupCallbacks.push(cleanup);
    return cleanup;
  }

  function observeRootContainerReplacement(): () => void {
    const cleanup = deps.observeDom(ensureToolbarMounted);
    cleanupCallbacks.push(cleanup);
    return cleanup;
  }

  function startToolbarHealthMonitor(): () => void {
    const interval = window.setInterval(ensureToolbarMounted, 1500);
    const cleanup = () => window.clearInterval(interval);
    cleanupCallbacks.push(cleanup);
    return cleanup;
  }

  function stop(): void {
    while (cleanupCallbacks.length) {
      cleanupCallbacks.pop()?.();
    }
  }

  return {
    ensureToolbarMounted,
    isToolbarPresent,
    mountToolbar,
    positionToolbar,
    removeDuplicateToolbars,
    observeChatGPTNavigationChanges,
    observeRootContainerReplacement,
    startToolbarHealthMonitor,
    stop
  };
}
