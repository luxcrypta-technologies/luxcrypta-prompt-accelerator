import { describe, expect, it } from "vitest";
import { extractSessionCandidates, partitionSessionCandidates } from "@/governance/partition";

describe("governance partition", () => {
  it("separates stable and open candidates", () => {
    const candidates = extractSessionCandidates({
      transformRequest: {
        sourceText:
          "Objective: Build a research prompt. Must cite sources. What evidence is missing? Note uncertainty where relevant.",
        mode: "research"
      }
    });
    const partition = partitionSessionCandidates(candidates);

    expect(partition.stableCandidates.some((candidate) => candidate.kind === "objective")).toBe(true);
    expect(partition.stableCandidates.some((candidate) => candidate.kind === "constraint")).toBe(true);
    expect(partition.opennessCandidates.some((candidate) => candidate.kind === "open_question")).toBe(true);
    expect(partition.opennessCandidates.some((candidate) => candidate.kind === "uncertainty")).toBe(true);
  });
});
