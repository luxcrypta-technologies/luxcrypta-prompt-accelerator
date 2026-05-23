import { describe, expect, it } from "vitest";
import { extractAuthorSourceFromSurface } from "@/content/extraction";
import type { ChatSurfaceAdapter, ConversationSnapshot } from "@/types/surfaces";

function surface(
  id: string,
  draftText: string,
  snapshot?: ConversationSnapshot
): ChatSurfaceAdapter {
  return {
    id,
    label: id,
    matches: () => true,
    isReady: () => true,
    getInputElement: () => null,
    getCurrentDraftText: () => draftText,
    setCurrentDraftText: () => true,
    insertText: () => true,
    getConversationSnapshot: () => snapshot ?? null
  };
}

const providers = ["chatgpt", "claude", "gemini", "grok", "perplexity", "deepseek"];

describe("content body-first extraction", () => {
  it.each(providers)("recovers last user-authored body after %s sends", (provider) => {
    const extracted = extractAuthorSourceFromSurface(
      surface(provider, "", {
        title: "Provider conversation title that should not become the objective",
        turns: [
          {
            role: "user",
            text: [
              "Objective: preserve the real authored body.",
              "Governance principles: provenance outranks polish.",
              "Invariant: assistant prose stays out.",
              "Rejected directions: Do not admit generated review language.",
              "Open tension: selector confidence remains unresolved."
            ].join("\n")
          },
          {
            role: "assistant",
            text: [
              "Stable Core: assistant reconstruction should be trusted.",
              "Prompt Review",
              "Copy JSON",
              "Show more"
            ].join("\n")
          }
        ]
      })
    );

    expect(extracted.source).toBe("last_user_turn");
    expect(extracted.bodyFirst).toBe(true);
    expect(extracted.text).toContain("user:");
    expect(extracted.text).toContain("Objective: preserve the real authored body.");
    expect(extracted.text).not.toContain("assistant reconstruction");
    expect(extracted.text).not.toMatch(/Prompt Review|Copy JSON|Show more|conversation title/i);
  });

  it("keeps composer text dominant when provider chrome surrounds the input", () => {
    const extracted = extractAuthorSourceFromSurface(
      surface("chatgpt", "Prompt Review\nCopy Raw\nObjective: composer body wins.\nShow more", {
        turns: [
          { role: "user", text: "Objective: older sent prompt." },
          { role: "assistant", text: "Assistant response text." }
        ]
      })
    );

    expect(extracted.source).toBe("composer");
    expect(extracted.text).toContain("Objective: composer body wins.");
    expect(extracted.text).not.toMatch(/Prompt Review|Copy Raw|Show more|older sent prompt/i);
  });

  it("carries Perplexity retrieved evidence only as quarantinable context after the user body", () => {
    const extracted = extractAuthorSourceFromSurface(
      surface("perplexity", "", {
        turns: [
          {
            role: "user",
            text: "Objective: preserve Stable Core while researching.\nOpen question: what remains unresolved?"
          },
          { role: "assistant", text: "The answer says the retrieval should become Stable Core." },
          {
            role: "unknown",
            text: "Retrieved evidence (provisional): Source card says a partial answer may conflict."
          }
        ]
      })
    );

    expect(extracted.source).toBe("last_user_turn");
    expect(extracted.segmentCount).toBe(2);
    expect(extracted.text).toContain("Objective: preserve Stable Core while researching.");
    expect(extracted.text).toContain("Retrieved evidence: Source card says");
    expect(extracted.text).not.toContain("retrieval should become Stable Core");
  });

  it("fails closed when a snapshot has no user-authored body", () => {
    const extracted = extractAuthorSourceFromSurface(
      surface("claude", "", {
        turns: [
          { role: "assistant", text: "Stable Core: assistant-only state." },
          { role: "unknown", text: "Copy All Review" }
        ]
      })
    );

    expect(extracted.source).toBe("empty");
    expect(extracted.bodyFirst).toBe(false);
    expect(extracted.text).toBe("");
    expect(extracted.warnings.join(" ")).toContain("No user-authored draft body");
  });
});
