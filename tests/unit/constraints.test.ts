import { describe, expect, it } from "vitest";
import { extractConstraints } from "@luxcrypta/continuity-core/constraints";

describe("extractConstraints", () => {
  it("detects hard requirements and output contracts", () => {
    const constraints = extractConstraints("Must return as JSON. Do not use tables. Keep under 100 words.");
    expect(constraints).toHaveLength(3);
    expect(constraints.every((constraint) => constraint.hard)).toBe(true);
    expect(constraints.map((constraint) => constraint.kind)).toContain("output_contract");
  });
});
