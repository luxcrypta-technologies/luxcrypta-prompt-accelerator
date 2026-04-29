import { describe, expect, it } from "vitest";
import { scoreCompressionDensity, scoreContinuity, scoreOpenness } from "@/governance/scoring";
import type { SessionOpennessState, SessionStableCore } from "@/types/governance";

describe("governance scoring", () => {
  it("scores continuity, openness, and density within bounds", () => {
    const core: SessionStableCore = {
      objective: "Keep the session coherent.",
      hardConstraints: ["Do not drop citations."],
      acceptedDecisions: ["Use bullet points."],
      lastUpdatedAt: "2026-01-01T00:00:00.000Z"
    };
    const openness: SessionOpennessState = {
      openQuestions: ["Which source is strongest?"],
      uncertaintyNotes: ["Evidence may change."],
      optionalBranches: ["Compare alternatives."],
      preservedCreativeSpace: true,
      lastUpdatedAt: "2026-01-01T00:00:00.000Z"
    };

    expect(scoreContinuity(core)).toBeGreaterThan(60);
    expect(scoreOpenness(openness)).toBeGreaterThan(30);
    expect(scoreCompressionDensity(1000, 200)).toBeGreaterThan(0);
    expect(scoreCompressionDensity(1000, 200)).toBeLessThanOrEqual(100);
  });
});
