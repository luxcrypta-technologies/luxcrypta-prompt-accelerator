import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";

describe("review flow data", () => {
  it("always provides transformed text, explanation, diff, and scores", () => {
    const result = transformPrompt({
      sourceText: "Please help me write a plan. Must use bullet points only.",
      mode: "focus"
    });
    expect(result.transformedText).toContain("Focus");
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.diff.length).toBeGreaterThan(0);
    expect(result.scores.constraintPreservationScore).toBe(1);
  });
});
