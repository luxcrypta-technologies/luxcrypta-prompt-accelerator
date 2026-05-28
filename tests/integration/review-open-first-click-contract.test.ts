import { describe, expect, it } from "vitest";
import { evaluateOpenPathContract } from "@/content/open-path-contract";
import { TOOLBAR_ID, TOOLBAR_ROOT_ID } from "@/content/toolbar-mount";
import type { ChatSurfaceAdapter } from "@/types/surfaces";

const PROVIDER_URLS: Record<string, string> = {
  deepseek: "https://chat.deepseek.com/a",
  chatgpt: "https://chatgpt.com/c/test",
  claude: "https://claude.ai/chat/test",
  grok: "https://grok.com/chat/test",
  gemini: "https://gemini.google.com/app/test"
};

function surface(id: string): ChatSurfaceAdapter {
  return {
    id,
    label: id,
    matches: () => true,
    isReady: () => document.querySelector("[data-input]") !== null,
    getInputElement: () => document.querySelector("[data-input]"),
    getCurrentDraftText: () => "Objective: stabilize first-click review opening.",
    setCurrentDraftText: () => true,
    insertText: () => true,
    getConversationSnapshot: () => ({
      turns: [
        {
          role: "user",
          text: "Objective: stabilize first-click review opening."
        }
      ]
    })
  };
}

function mountProviderFixture(provider: string): void {
  document.body.innerHTML = `
    <main>
      <div id="${TOOLBAR_ROOT_ID}" data-surface="${provider}">
        <div id="${TOOLBAR_ID}" class="lcpa-toolbar"></div>
      </div>
      <textarea data-input>Objective: stabilize first-click review opening.</textarea>
    </main>
  `;
}

describe("first-click review open contract", () => {
  for (const provider of Object.keys(PROVIDER_URLS)) {
    it(`allows ${provider} to proceed on the minimal first-click contract`, () => {
      mountProviderFixture(provider);

      const result = evaluateOpenPathContract(surface(provider));

      expect(result).toMatchObject({
        ok: true,
        stage: "ready_to_open",
        snapshot: {
          provider,
          provider_root_present: true,
          authored_body_target_present: true,
          toolbar_mounted: true,
          toolbar_root_mounted: true,
          toolbar_current_provider_bound: true,
          click_route_bound: true
        }
      });
      expect(result.snapshot.provider_root_selector_used).toContain("main");
    });
  }

  it("names the exact blocker stage when the toolbar is stale", () => {
    mountProviderFixture("chatgpt");
    document.getElementById(TOOLBAR_ROOT_ID)?.setAttribute("data-surface", "claude");

    const result = evaluateOpenPathContract(surface("chatgpt"));

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("toolbar_mount");
    expect(result.reason).toContain("toolbar");
  });
});
