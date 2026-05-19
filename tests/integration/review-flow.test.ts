import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";

describe("review flow data", () => {
  it("always provides transformed text, explanation, diff, and scores", () => {
    const result = transformPrompt({
      sourceText: "Please help me write a plan. Must use bullet points only.",
      mode: "focus"
    });
    expect(result.transformedText).toContain("Objective:");
    expect(result.transformedText).not.toContain("Focus the response");
    expect(result.continuityReview.cleanSummary).toContain("continuity runtime");
    expect(result.continuityReview.activeObjective).toBeTruthy();
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.diff.length).toBeGreaterThan(0);
    expect(result.scores.constraintPreservationScore).toBe(1);
  });

  it("keeps Grok target selection visible in review flow data", () => {
    const result = transformPrompt({
      sourceText: "Objective: summarize this session. Must keep open questions visible.",
      targetModel: "grok"
    });

    expect(result.targetModelApplied).toBe("grok");
    expect(result.transformedText).toContain("Keep the tone concise");
    expect(result.explanation).toContain("Applied grok formatting preferences.");
  });

  it("parses carry-forward capsules into human-readable review state", () => {
    const result = transformPrompt({
      sourceText: `Carry-forward capsule:
{
  "capsule_version": 1,
  "id": "capsule_test",
  "title": "Runtime refactor",
  "objective": "Refactor the extension into an always-on continuity runtime.",
  "constraints": ["Do not expose Compress or Focus controls."],
  "decisions": ["Decision: Advanced is inspection-only."],
  "open_questions": ["How should save controls be handled later?"],
  "preferred_mode": "code",
  "notes": "Next action: verify the review window stays human-readable.",
  "sourceSurface": "chatgpt",
  "created_at": "2026-05-17T00:00:00.000Z"
}

Also keep raw diagnostics collapsed.`
    });

    expect(result.continuityReview.activeObjective).toContain("always-on continuity runtime");
    expect(result.continuityReview.stableCore.join(" ")).toContain("Do not expose Compress or Focus controls.");
    expect(result.continuityReview.openUnresolved.join(" ")).toContain("save controls");
    expect(result.continuityReview.newProvisional.join(" ")).toContain("raw diagnostics collapsed");
    expect(result.continuityReview.diagnostics.parsedCapsule?.preferred_mode).toBe("code");
  });
});
