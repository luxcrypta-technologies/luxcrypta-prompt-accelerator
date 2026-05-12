import { describe, expect, it } from "vitest";
import { scoreCompressionDensity, scoreContinuity, scoreDrift, scoreOpenness } from "@luxcrypta/continuity-governance/scoring";
import type { SessionGovernanceState, SessionOpennessState, SessionStableCore } from "@luxcrypta/continuity-types/governance";

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

  it("raises drift when objective and output contract both change", () => {
    const previous: SessionGovernanceState = {
      id: "session_test",
      stableCore: {
        objective: "Write a research brief.",
        hardConstraints: ["Must cite sources."],
        acceptedDecisions: ["Use bullet points."],
        outputContract: "Use bullet points.",
        lastUpdatedAt: "2026-01-01T00:00:00.000Z"
      },
      noveltyLane: [],
      opennessLane: {
        openQuestions: [],
        uncertaintyNotes: [],
        optionalBranches: [],
        preservedCreativeSpace: false,
        lastUpdatedAt: "2026-01-01T00:00:00.000Z"
      },
      monitors: {
        continuityScore: 80,
        driftScore: 0,
        noveltyLoad: 0,
        opennessScore: 0,
        compressionDensity: 70,
        sessionHealth: "healthy"
      },
      diagnostics: {
        stableCoreSummary: [],
        noveltySummary: [],
        opennessSummary: [],
        warnings: [],
        actionsSuggested: [],
        generatedAt: "2026-01-01T00:00:00.000Z"
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    expect(
      scoreDrift(previous, {
        objective: "Design a launch plan.",
        hardConstraints: ["Must cite sources.", "Return JSON."],
        acceptedDecisions: ["Use bullet points."],
        outputContract: "Return JSON.",
        lastUpdatedAt: "2026-01-01T00:00:00.000Z"
      })
    ).toBeGreaterThan(50);
  });
});
