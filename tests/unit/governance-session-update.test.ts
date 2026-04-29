import { describe, expect, it } from "vitest";
import { transformPrompt } from "@/core/pipeline";
import { updateSessionGovernance } from "@/governance/session-update";

describe("governance session update", () => {
  it("preserves stable core and isolates changed instructions as novelty", () => {
    const firstRequest = {
      sourceText: "Objective: Write a research brief. Must cite sources. Output bullet points only.",
      mode: "research" as const
    };
    const first = updateSessionGovernance({
      transformRequest: firstRequest,
      transformResult: transformPrompt(firstRequest)
    });

    const secondRequest = {
      sourceText:
        "Objective: Write a research brief. Must cite sources. Output bullet points only. Instead, add a risk table.",
      mode: "research" as const
    };
    const second = updateSessionGovernance({
      previousState: first.state,
      transformRequest: secondRequest,
      transformResult: transformPrompt(secondRequest)
    });

    expect(second.state.stableCore.objective).toBe(first.state.stableCore.objective);
    expect(second.state.stableCore.hardConstraints.join(" ")).toContain("cite");
    expect(second.state.noveltyLane.some((item) => item.kind === "changed_constraint" || item.kind === "output_shift")).toBe(
      true
    );
  });
});
