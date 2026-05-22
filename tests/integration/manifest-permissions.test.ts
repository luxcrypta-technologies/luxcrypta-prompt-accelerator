import { describe, expect, it } from "vitest";
import chromiumManifest from "../../apps/extension/manifests/manifest.chromium.json";
import firefoxManifest from "../../apps/extension/manifests/manifest.firefox.json";

type ExtensionManifest = {
  content_scripts?: Array<{
    matches?: string[];
  }>;
};

function contentScriptMatches(manifest: ExtensionManifest): string[] {
  return manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
}

describe("extension manifest permissions", () => {
  it("adds only narrow provider web surface matches", () => {
    for (const manifest of [chromiumManifest, firefoxManifest]) {
      const matches = contentScriptMatches(manifest);
      expect(matches).toContain("https://grok.com/*");
      expect(matches.filter((match) => match.includes("grok"))).toEqual(["https://grok.com/*"]);
      expect(matches.filter((match) => match.includes("deepseek"))).toEqual([
        "https://chat.deepseek.com/*",
        "https://deepseek.com/chat*",
        "https://www.deepseek.com/chat*"
      ]);
      expect(matches.filter((match) => match.includes("perplexity"))).toEqual([
        "https://perplexity.ai/*",
        "https://www.perplexity.ai/*"
      ]);
      expect(matches.some((match) => match === "https://*.deepseek.com/*")).toBe(false);
      expect(matches.some((match) => match.includes("x.com"))).toBe(false);
      expect(matches.some((match) => match.includes("twitter.com"))).toBe(false);
    }
  });
});
