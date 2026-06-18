import { describe, expect, it } from "vitest";
import { evaluateOpenPathContract } from "@/content/open-path-contract";
import type { ChatSurfaceAdapter } from "@/types/surfaces";

describe("open path survives a throwing snapshot (DeepSeek 2.5.5 regression)", () => {
  it("does not throw when getConversationSnapshot throws and no input element", () => {
    document.body.innerHTML = `<main></main>`;
    const surface: ChatSurfaceAdapter = {
      id: "deepseek",
      label: "DeepSeek",
      matches: () => true,
      isReady: () => true,
      getInputElement: () => null,
      getCurrentDraftText: () => "",
      setCurrentDraftText: () => false,
      insertText: () => false,
      getConversationSnapshot: () => { throw new Error("snapshot boom"); }
    };
    // Before the guard this throw propagated out of the contract and aborted open.
    expect(() => evaluateOpenPathContract(surface)).not.toThrow();
    const res = evaluateOpenPathContract(surface);
    // Contract returns a structured result (not a crash).
    expect(res).toHaveProperty("ok");
  });
});
