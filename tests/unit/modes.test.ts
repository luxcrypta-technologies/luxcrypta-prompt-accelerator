import { describe, expect, it } from "vitest";
import { applyModeTemplate } from "@/core/modes";

describe("applyModeTemplate", () => {
  it("adds useful structure for code mode", () => {
    const result = applyModeTemplate("Objective: fix the bug", "code", []);
    expect(result).toContain("Implementation task");
    expect(result).toContain("Tests");
  });
});
