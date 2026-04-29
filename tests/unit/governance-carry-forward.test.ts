import { describe, expect, it } from "vitest";
import { transformPrompt } from "@/core/pipeline";
import { updateSessionGovernance } from "@/governance/session-update";

describe("governance carry-forward", () => {
  it("creates a compact candidate from stable core and openness", () => {
    const request = {
      sourceText:
        "Objective: Draft a product plan. Must keep privacy local-only. Decision: use browser storage. What risks remain?",
      mode: "precision" as const
    };
    const result = updateSessionGovernance({
      transformRequest: request,
      transformResult: transformPrompt(request)
    });

    expect(result.carryForwardCandidate.objective).toBe(result.state.stableCore.objective);
    expect(result.carryForwardCandidate.constraints.join(" ")).toContain("privacy");
    expect(result.carryForwardCandidate.open_questions.join(" ")).toContain("risks");
  });
});
