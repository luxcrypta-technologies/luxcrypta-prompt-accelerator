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
});
