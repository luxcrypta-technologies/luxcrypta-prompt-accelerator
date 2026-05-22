import { describe, expect, it } from "vitest";
import { buildContinuityHandoff, PROVIDER_TARGETS } from "@luxcrypta/continuity-routing";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";

describe("continuity routing", () => {
  it("generates provider-specific handoffs for each MVP target", () => {
    const session = updateSessionGovernance({
      transformRequest: {
        sourceText:
          "Objective: ship the desktop MVP. Must stay local-first. Decision: use Electron. Open question: should SQLite wait?",
        mode: "focus",
        targetModel: "chatgpt"
      }
    }).state;

    for (const target of PROVIDER_TARGETS) {
      const handoff = buildContinuityHandoff({ target, session });
      expect(handoff.target).toBe(target);
      expect(handoff.text).toContain("Continuity Handoff");
      expect(handoff.text).toContain("local-first");
      expect(handoff.text).toContain("Open State");
    }
  });

  it("builds a Grok-specific continuity handoff profile", () => {
    const session = updateSessionGovernance({
      transformRequest: {
        sourceText:
          "Objective: add Grok support. Must target grok.com first. Open question: live smoke timing?",
        mode: "focus",
        targetModel: "grok"
      }
    }).state;

    const handoff = buildContinuityHandoff({
      target: "grok",
      session,
      notes: "Keep provider internals out of scope."
    });

    expect(PROVIDER_TARGETS).toContain("grok");
    expect(handoff.label).toBe("Grok");
    expect(handoff.text).toContain("Grok Continuity Handoff");
    expect(handoff.text).toContain("grok.com first");
    expect(handoff.text).toContain("Keep provider internals out of scope.");
  });

  it("builds DeepSeek and Perplexity continuity handoff profiles", () => {
    const session = updateSessionGovernance({
      transformRequest: {
        sourceText:
          "Objective: preserve portable operational continuity. Must keep Stable State separate. Open question: source conflict policy?",
        mode: "research",
        targetModel: "perplexity"
      }
    }).state;

    const deepseek = buildContinuityHandoff({ target: "deepseek", session });
    const perplexity = buildContinuityHandoff({ target: "perplexity", session });

    expect(PROVIDER_TARGETS).toEqual([
      "chatgpt",
      "claude",
      "gemini",
      "grok",
      "deepseek",
      "perplexity"
    ]);
    expect(deepseek.text).toContain("DeepSeek Continuity Handoff");
    expect(deepseek.text).toContain("schema_strict");
    expect(deepseek.text).toContain("keep rejected directions visible");
    expect(perplexity.text).toContain("Perplexity Continuity Handoff");
    expect(perplexity.text).toContain("source_contamination_resistant");
    expect(perplexity.text).toContain("retrieved or cited material as provisional evidence");
  });
});
