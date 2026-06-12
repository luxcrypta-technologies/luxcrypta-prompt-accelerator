import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";

// Reproduces F4: within ONE session the objective changes wholesale across
// unrelated topics. The objective field updates correctly, but stale hard
// constraints from the abandoned topic were carried forward into stable_core
// under the new objective — the live "microgrid objective with hot-yoga
// constraints" contamination. These tests assert against genuinely-captured
// hardConstraints (verified phrasing) so they exercise the real mechanism.
function step(previousState: any, sourceText: string) {
  const request = { sourceText, mode: "precision" as const };
  return updateSessionGovernance({
    transformRequest: request,
    transformResult: transformPrompt(request),
    previousState
  });
}

describe("F4: wholesale objective pivot must not carry stale stable-core", () => {
  it("drops the abandoned topic's hard constraints after a wholesale pivot", () => {
    // Turn 1: hot yoga, with a real captured hard constraint.
    let r = step(
      null,
      "Objective: plan a hot yoga program. The studio temperature must be 40C as a hard requirement."
    );
    expect(r.state.stableCore.hardConstraints.join(" ")).toContain("40C");

    // Turn 2: wholesale pivot to microgrid (dissimilar objective).
    r = step(r.state, "Objective: build it as a microgrid architecture diagram and spec sheet.");

    expect(r.state.stableCore.objective.toLowerCase()).toContain("microgrid");
    // The stale hot-yoga constraint must NOT survive under the microgrid objective.
    expect(r.state.stableCore.hardConstraints.join(" ")).not.toContain("40C");
    expect(r.state.stableCore.hardConstraints.join(" ").toLowerCase()).not.toContain("temperature");
  });

  it("KEEPS hard constraints when the objective is only restated (not a pivot)", () => {
    let r = step(
      null,
      "Objective: plan a hot yoga program. The studio temperature must be 40C as a hard requirement."
    );
    expect(r.state.stableCore.hardConstraints.join(" ")).toContain("40C");

    // Restatement / refinement of the SAME objective -> constraints carry forward.
    r = step(r.state, "Objective: plan the hot yoga program in more detail.");

    expect(r.state.stableCore.objective.toLowerCase()).toContain("yoga");
    expect(r.state.stableCore.hardConstraints.join(" ")).toContain("40C");
  });
});
