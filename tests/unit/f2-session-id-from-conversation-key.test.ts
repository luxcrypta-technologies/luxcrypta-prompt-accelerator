import { describe, expect, it } from "vitest";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";

// F2: session.id was derived from the FIRST objective's slug and then frozen via
// previous?.id. So a conversation that pivoted topic kept a stale, misleading id
// (e.g. a World Cup capsule carrying "session_that_s_squarely_what_echogate...").
// When a conversationKey is available it is the stable, correct identity for the
// session and should drive state.id instead of the objective text.
function step(previousState: any, sourceText: string, conversationKey?: string) {
  return updateSessionGovernance({
    transformRequest: { sourceText, mode: "precision" },
    previousState,
    conversationKey
  } as never);
}

describe("F2: session.id is derived from the conversationKey, not the objective text", () => {
  it("uses a stable id from conversationKey and keeps it across an objective pivot", () => {
    let r = step(null, "Objective: plan a hot yoga program.", "chatgpt:thread-123");
    const id1 = r.state.id;
    expect(id1).toContain("chatgpt");
    expect(id1).not.toContain("yoga"); // not derived from objective text

    // Pivot the objective wholesale within the SAME conversation.
    r = step(r.state, "Objective: build a microgrid architecture spec.", "chatgpt:thread-123");
    // Same conversation -> same stable id (no stale objective slug, no churn).
    expect(r.state.id).toBe(id1);
    expect(r.state.id).not.toContain("microgrid");
  });

  it("falls back to the objective slug when no conversationKey is present (back-compat)", () => {
    const r = step(null, "Objective: plan a hot yoga program.");
    expect(r.state.id.startsWith("session_")).toBe(true);
  });

  it("different conversations get different ids", () => {
    const a = step(null, "Objective: plan a trip.", "chatgpt:thread-A");
    const b = step(null, "Objective: plan a trip.", "claude:thread-B");
    expect(a.state.id).not.toBe(b.state.id);
  });
});
