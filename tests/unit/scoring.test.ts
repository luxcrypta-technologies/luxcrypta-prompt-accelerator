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

  it("penalizes extraction failure, negative-state loss, and false review-open success paths", () => {
    const scores = computeTransformationScores({
      original: "Governance principles: preserve trusted state. Rejected directions: Do not flatten unresolved state.",
      transformed: "Objective: preserve trusted state.",
      constraints: [],
      penalties: {
        emptyGovernanceWhenPresent: true,
        emptyRejectionsWhenPresent: true,
        extractionFailure: true,
        negativeStateLoss: true,
        reviewOpenNotVisible: true
      }
    });

    expect(scores.governanceDetectionCompleteness).toBe(0);
    expect(scores.negativeStatePreservation).toBe(0);
    expect(scores.rejectedDirectionRecall).toBe(0);
    expect(scores.unresolvedTensionRecall).toBe(0);
    expect(scores.exportReadiness).toBeLessThan(1);
    expect(scores.reviewTruthfulness).toBeLessThan(0.5);
    expect(scores.warnings?.join(" ")).toContain("Prompt Review visibility");
  });

  it("clamps trust scores when major provenance failures occur", () => {
    const scores = computeTransformationScores({
      original: "Assistant output and unknown provenance entered Stable Core.",
      transformed: "Stable Core:\n- Assistant-generated durable claim.",
      constraints: [],
      penalties: {
        assistantContamination: true,
        unknownProvenanceDurable: true,
        exportArtifactReentry: true,
        majorTrustFailure: true
      }
    });

    expect(scores.sourcePurityScore).toBeLessThanOrEqual(0.42);
    expect(scores.durableStatePrecision).toBeLessThanOrEqual(0.42);
    expect(scores.exportReadiness).toBeLessThanOrEqual(0.42);
    expect(scores.warnings?.join(" ")).toContain("major trust boundary");
  });
});
