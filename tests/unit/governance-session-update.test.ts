import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";

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

  it("does not keep established output format requirements in novelty", () => {
    const firstRequest = {
      sourceText:
        "I need a concise research prompt for evaluating open-source browser extensions. Citations are required. Output in bullet points only.",
      mode: "research" as const
    };
    const first = updateSessionGovernance({
      transformRequest: firstRequest,
      transformResult: transformPrompt(firstRequest)
    });

    const secondRequest = {
      sourceText:
        "Make it slightly more precise, but keep citations required and bullet points only.",
      mode: "research" as const
    };
    const second = updateSessionGovernance({
      previousState: first.state,
      transformRequest: secondRequest,
      transformResult: transformPrompt(secondRequest)
    });

    expect(second.state.stableCore.outputContract).toMatch(/bullet points only/i);
    expect(second.state.noveltyLane.some((item) => /bullet points only/i.test(item.text))).toBe(false);
  });

  it("flags recurring non-conflicting novelty as promotable", () => {
    const baseRequest = {
      sourceText: "Objective: Write a research brief. Must cite sources. Output bullet points only.",
      mode: "research" as const
    };
    const base = updateSessionGovernance({
      transformRequest: baseRequest,
      transformResult: transformPrompt(baseRequest)
    });

    const noveltyRequest = {
      sourceText:
        "Objective: Write a research brief. Must cite sources. Output bullet points only. Must compare privacy implications.",
      mode: "research" as const
    };
    const firstNovelty = updateSessionGovernance({
      previousState: base.state,
      transformRequest: noveltyRequest,
      transformResult: transformPrompt(noveltyRequest)
    });
    const repeatedNovelty = updateSessionGovernance({
      previousState: firstNovelty.state,
      transformRequest: noveltyRequest,
      transformResult: transformPrompt(noveltyRequest)
    });

    const privacyItem = repeatedNovelty.state.noveltyLane.find((item) => /privacy implications/i.test(item.text));
    expect(privacyItem?.promotable).toBe(true);
    expect(repeatedNovelty.state.diagnostics.actionsSuggested.join(" ")).toMatch(/promoting/i);
  });
});
