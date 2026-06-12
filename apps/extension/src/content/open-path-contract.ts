import { TOOLBAR_ID, TOOLBAR_ROOT_ID } from "./toolbar-mount";
import type { ChatSurfaceAdapter } from "@/types/surfaces";

export type OpenPathBlockerStage =
  | "provider_root"
  | "authored_body_target"
  | "toolbar_mount"
  | "click_route"
  | "ready_to_open";

export interface OpenPathRuntimeSnapshot {
  provider: string;
  active_url: string;
  active_domain: string;
  provider_root_selector_used: string;
  provider_root_present: boolean;
  authored_body_target_present: boolean;
  toolbar_mounted: boolean;
  toolbar_root_mounted: boolean;
  toolbar_root_surface?: string;
  toolbar_current_provider_bound: boolean;
  click_route_bound: boolean;
}

export interface OpenPathContractResult {
  ok: boolean;
  stage: OpenPathBlockerStage;
  reason?: string;
  snapshot: OpenPathRuntimeSnapshot;
}

const PROVIDER_ROOT_SELECTORS: Record<string, string> = {
  chatgpt: "main, form, #prompt-textarea, [data-testid='prompt-textarea']",
  claude: "main, div.ProseMirror[contenteditable='true'], [contenteditable='true'][aria-label*='message' i]",
  deepseek:
    "main, [data-testid*='chat' i], [data-testid*='input' i], textarea, [contenteditable='true'][role='textbox']",
  grok: "main, div.ProseMirror[contenteditable='true'], [contenteditable='true'][role='textbox']",
  gemini: "main, rich-textarea, [contenteditable='true'][aria-label*='Enter a prompt' i]",
  perplexity: "main, textarea, [contenteditable='true']"
};

function activeDomain(): string {
  try {
    return new URL(window.location.href).hostname;
  } catch {
    return "unknown";
  }
}

function rootSelectorFor(provider: string): string {
  return PROVIDER_ROOT_SELECTORS[provider] ?? "body";
}

function hasAuthoredBodyTarget(surface: ChatSurfaceAdapter): boolean {
  if (surface.getInputElement()) return true;
  // The snapshot is a best-effort signal here. It must NEVER throw out of the
  // open-path contract — if it did, a heavy or unexpected provider DOM would
  // abort the panel open entirely (observed: DeepSeek panel failing to open
  // after the snapshot was rescoped). Fall back to "no authored target" on any
  // error; the input-element check above already covers the common case.
  try {
    const snapshot = surface.getConversationSnapshot?.();
    return Boolean(snapshot?.turns.some((turn) => turn.role === "user" && turn.text.trim()));
  } catch {
    return false;
  }
}

export function evaluateOpenPathContract(surface: ChatSurfaceAdapter): OpenPathContractResult {
  const providerRootSelector = rootSelectorFor(surface.id);
  const providerRootPresent = Boolean(document.querySelector(providerRootSelector));
  const authoredBodyTargetPresent = hasAuthoredBodyTarget(surface);
  const toolbar = document.getElementById(TOOLBAR_ID);
  const toolbarRoot = document.getElementById(TOOLBAR_ROOT_ID);
  const toolbarMounted = Boolean(toolbar?.isConnected);
  const toolbarRootMounted = Boolean(toolbarRoot?.isConnected);
  const toolbarRootSurface = toolbarRoot?.dataset.surface;
  const toolbarCurrentProviderBound =
    toolbarMounted && toolbarRootMounted && toolbarRootSurface === surface.id;
  const clickRouteBound = toolbarCurrentProviderBound && surface.matches(window.location.href);
  const snapshot: OpenPathRuntimeSnapshot = {
    provider: surface.id,
    active_url: window.location.href,
    active_domain: activeDomain(),
    provider_root_selector_used: providerRootSelector,
    provider_root_present: providerRootPresent,
    authored_body_target_present: authoredBodyTargetPresent,
    toolbar_mounted: toolbarMounted,
    toolbar_root_mounted: toolbarRootMounted,
    toolbar_root_surface: toolbarRootSurface,
    toolbar_current_provider_bound: toolbarCurrentProviderBound,
    click_route_bound: clickRouteBound
  };

  if (!providerRootPresent) {
    return {
      ok: false,
      stage: "provider_root",
      reason: "provider root was not present",
      snapshot
    };
  }
  if (!authoredBodyTargetPresent) {
    return {
      ok: false,
      stage: "authored_body_target",
      reason: "no active composer or authored body target was present",
      snapshot
    };
  }
  if (!toolbarCurrentProviderBound) {
    return {
      ok: false,
      stage: "toolbar_mount",
      reason: "toolbar was not mounted on the current provider root",
      snapshot
    };
  }
  if (!clickRouteBound) {
    return {
      ok: false,
      stage: "click_route",
      reason: "click route was not bound to the current provider",
      snapshot
    };
  }
  return { ok: true, stage: "ready_to_open", snapshot };
}
