import { describe, expect, it } from "vitest";
import { computeTransformationScores } from "@luxcrypta/continuity-core/scoring";

describe("computeTransformationScores", () => {
  it("scores preserved hard constraints", () => {
    const scores = computeTransformationScores({
      original: "Must use JSON.",
      transformed: "Requirements:\n- Must use JSON.",
      constraints: [
        {
          id: "c1",
          text: "Must use JSON.",
          kind: "output_contract",
          hard: true,
          confidence: 0.9
        }
      ]
    });
    expect(scores.constraintPreservationScore).toBe(1);
    expect(scores.riskScore).toBe(0);
  });

  it("penalizes degraded preservation and writeback failures", () => {
    const scores = computeTransformationScores({
      original: "Must use JSON.",
      transformed: "Requirements:\n- Must use JSON.",
      constraints: [
        {
          id: "c1",
          text: "Must use JSON.",
          kind: "output_contract",
          hard: true,
          confidence: 0.9
        }
      ],
      penalties: {
        writebackFailed: true,
        bucketOverlap: true,
        rejectedDirectionAmbiguity: true
      }
    });

    expect(scores.constraintPreservationScore).toBeLessThan(1);
    expect(scores.riskScore).toBeGreaterThan(0);
    expect(scores.warnings?.join(" ")).toContain("writeback failure");
    expect(scores.warnings?.join(" ")).toContain("bucket overlap");
  });
});
