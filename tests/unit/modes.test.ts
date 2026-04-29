import { describe, expect, it } from "vitest";
import { applyModeTemplate } from "@/core/modes";

describe("applyModeTemplate", () => {
  it("adds useful structure for code mode", () => {
    const result = applyModeTemplate("Objective: fix the bug", "code", []);
    expect(result).toContain("Implementation task");
    expect(result).toContain("Tests");
  });

  it("does not append duplicate hard requirements already present in the prompt", () => {
    const result = applyModeTemplate(
      "Objective: write a research prompt.\n\nRequirements:\n- Do not remove the requirement for citations.",
      "focus",
      [
        {
          id: "constraint_1",
          text: "Do not remove the requirement for citations.",
          kind: "forbidden",
          hard: true,
          confidence: 0.95
        }
      ]
    );

    expect(result.match(/Do not remove the requirement for citations/g)).toHaveLength(1);
    expect(result).not.toContain("Hard requirements");
  });
});
