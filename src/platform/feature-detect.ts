import type { BrowserCapabilities, ExtensionPlatform } from "@/types/platform";

interface RuntimeGlobal {
  sidePanel?: unknown;
  storage?: { local?: unknown };
  action?: unknown;
}

export function detectCapabilities(runtime: RuntimeGlobal, hasBrowserNamespace: boolean): BrowserCapabilities {
  return {
    supportsSidePanel: typeof runtime.sidePanel !== "undefined",
    supportsBrowserNamespace: hasBrowserNamespace,
    supportsActionPopup: typeof runtime.action !== "undefined",
    supportsStorageLocal: typeof runtime.storage?.local !== "undefined"
  };
}

export function createExtensionPlatform(
  name: ExtensionPlatform["name"],
  runtime: RuntimeGlobal,
  hasBrowserNamespace: boolean
): ExtensionPlatform {
  return {
    name,
    capabilities: detectCapabilities(runtime, hasBrowserNamespace)
  };
}
