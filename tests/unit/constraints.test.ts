import { describe, expect, it } from "vitest";
import { extractConstraints } from "@luxcrypta/continuity-core/constraints";

describe("extractConstraints", () => {
  it("detects hard requirements and output contracts", () => {
    const constraints = extractConstraints("Must return as JSON. Do not use tables. Keep under 100 words.");
    expect(constraints).toHaveLength(3);
    expect(constraints.every((constraint) => constraint.hard)).toBe(true);
    expect(constraints.map((constraint) => constraint.kind)).toContain("output_contract");
  });
  it("rejects conversational narration that incidentally contains cue words", () => {
    // Real fragments from a long exploratory session that previously got
    // mis-admitted as durable constraints (over-admission bug).
    const narration = [
      "I don't have all the answers.",
      "In the meantime, I have never really used an ai agent in any capacity.",
      "Prompt Accelerator is only 151kb.",
      "I am genuinely trying to understand the uses of this discipline."
    ].join(" ");
    const constraints = extractConstraints(narration);
    expect(constraints).toHaveLength(0);
  });

  it("still detects directive constraints alongside narration", () => {
    const mixed = "I think we should be careful. Must return as JSON. Use dumbbells only.";
    const constraints = extractConstraints(mixed);
    expect(constraints.length).toBeGreaterThanOrEqual(2);
    expect(constraints.every((c) => !/^i think/i.test(c.text))).toBe(true);
  });
});
