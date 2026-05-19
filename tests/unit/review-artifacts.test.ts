import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import {
  buildCapsuleDraft,
  buildWorkflowDraft,
  formatContinuityExport
} from "@/review/continuity-artifacts";

describe("review continuity artifacts", () => {
  const result = transformPrompt({
    sourceText: `Carry-forward capsule:
{
  "capsule_version": 1,
  "id": "capsule_strategy",
  "title": "Prompt Accelerator Marketing Strategy",
  "objective": "Launch the Prompt Accelerator with premium continuity positioning.",
  "constraints": ["Do not reintroduce Compress or Focus buttons."],
  "decisions": ["Decision: Keep review toolbar actions visible."],
  "open_questions": ["How should saved artifacts be reused from the toolbar?"],
  "preferred_mode": "executive_summary",
  "notes": "Next action: make review columns symmetrical.",
  "sourceSurface": "chatgpt",
  "created_at": "2026-05-18T00:00:00.000Z"
}

Also make Copy export clean and human-readable.`
  });
  const transformedText = `${result.transformedText}\n\nRecommended next action: QA the review window.`;

  it("formats Copy as a clean human-readable continuity review", () => {
    const copied = formatContinuityExport(result, transformedText);

    expect(copied).toContain("Active Objective");
    expect(copied).toContain("Stable Core");
    expect(copied).toContain("New / Provisional");
    expect(copied).toContain("Open / Unresolved");
    expect(copied).toContain("Recommended Next Actions");
    expect(copied).toContain("Transformed Continuity Draft");
    expect(copied).not.toContain("\"capsule_version\"");
    expect(copied).not.toContain("pipelineSteps");
  });

  it("builds a reusable workflow from review state", () => {
    const workflow = buildWorkflowDraft(result, transformedText);

    expect(workflow.title).toContain("Launch the Prompt Accelerator");
    expect(workflow.objective).toContain("premium continuity positioning");
    expect(workflow.constraints.join(" ")).toContain("Do not reintroduce Compress or Focus buttons.");
    expect(workflow.outputPreferences.join(" ")).toContain("Accepted decision");
    expect(workflow.carryForwardContext).toContain("Continuity Review");
  });

  it("builds a carry-forward capsule that preserves decisions and open items", () => {
    const capsule = buildCapsuleDraft(result, transformedText);

    expect(capsule.title).toContain("Capsule");
    expect(capsule.objective).toContain("premium continuity positioning");
    expect(capsule.constraints.join(" ")).toContain("Do not reintroduce Compress or Focus buttons.");
    expect(capsule.decisions.join(" ")).toContain("Keep review toolbar actions visible.");
    expect(capsule.open_questions.join(" ")).toContain("saved artifacts");
    expect(capsule.notes).toContain("Recommended Next Actions");
  });
});
