import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import {
  buildDiagnosticState,
  buildPortableCapsuleArtifact,
  buildPortableWorkflowArtifact,
  buildCapsuleDraft,
  buildWorkflowDraft,
  formatContinuityExport,
  formatDiagnosticMarkdown
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

    expect(workflow.version).toBe(1);
    expect(workflow.source_platform).toBe("chatgpt");
    expect(workflow.title).toContain("Launch the Prompt Accelerator");
    expect(workflow.objective).toContain("premium continuity positioning");
    expect(workflow.constraints.join(" ")).toContain("Do not reintroduce Compress or Focus buttons.");
    expect(workflow.accepted_decisions?.join(" ")).toContain("Keep review toolbar actions visible.");
    expect(workflow.diagnostic_data).toMatchObject({
      source_surface: "chatgpt"
    });
    expect(workflow.outputPreferences.join(" ")).toContain("Accepted decision");
    expect(workflow.carryForwardContext).toContain("Continuity Review");
  });

  it("builds a carry-forward capsule that preserves decisions and open items", () => {
    const capsule = buildCapsuleDraft(result, transformedText);

    expect(capsule.version).toBe(1);
    expect(capsule.source_platform).toBe("chatgpt");
    expect(capsule.title).toContain("Capsule");
    expect(capsule.objective).toContain("premium continuity positioning");
    expect(capsule.constraints.join(" ")).toContain("Do not reintroduce Compress or Focus buttons.");
    expect(capsule.decisions.join(" ")).toContain("Keep review toolbar actions visible.");
    expect(capsule.open_questions.join(" ")).toContain("saved artifacts");
    expect(capsule.reconstruction_instructions).toContain("reconstruct");
    expect(capsule.notes).toContain("Recommended Next Actions");
  });

  it("exports distinct portable workflow, capsule, and diagnostic artifacts", () => {
    const workflow = {
      ...buildWorkflowDraft(result, transformedText),
      id: "workflow_test",
      workflow_id: "workflow_test",
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z"
    };
    const capsule = {
      capsule_version: 1 as const,
      ...buildCapsuleDraft(result, transformedText),
      id: "capsule_test",
      capsule_id: "capsule_test",
      created_at: "2026-05-19T00:00:00.000Z",
      updated_at: "2026-05-19T00:00:00.000Z"
    };
    const context = {
      result,
      transformedText,
      sessionState: null,
      extensionVersion: "2.2.1",
      currentUrl: "chrome-extension://review.html",
      workflow,
      capsule
    };

    const portableWorkflow = buildPortableWorkflowArtifact(workflow, context);
    const portableCapsule = buildPortableCapsuleArtifact(capsule, context);
    const diagnostic = buildDiagnosticState(context);
    const markdown = formatDiagnosticMarkdown(context);

    expect(portableWorkflow).toMatchObject({
      workflow_id: "workflow_test",
      version: 1,
      continuity_review: expect.any(Object),
      diagnostic_data: expect.any(Object)
    });
    expect(portableCapsule).toMatchObject({
      capsule_id: "capsule_test",
      version: 1,
      reconstruction_instructions: expect.stringContaining("reconstruct")
    });
    expect(diagnostic).toMatchObject({
      version: 1,
      raw_capsule: expect.any(Object),
      raw_workflow_state: expect.any(Object),
      extension_version: "2.2.1"
    });
    expect(markdown).toContain("LuxCrypta Diagnostic State");
    expect(markdown).toContain("Raw JSON");
  });

  it("filters conversational, UI, screenshot, and quoted-block debris from portable state", () => {
    const noisy = transformPrompt({
      sourceText: `Hybrid Workspace

Okay, I'm uploading the images.
Just stand by.
This is what I see when I click the SAVE button.
Show moreShow less
Analyze everything.

The next engineering objective is: evaluate Prompt Accelerator continuity behavior and refine save/export functionality.

Hard requirements:
- Must maintain workflow continuity across sessions.
- Preserve rejected directions explicitly.
- Keep unresolved tensions visible.
- Avoid flattening governance state.
- Use the Product Hunt screenshot instructions to capture full-page before/after browser screenshots for the launch page, including crop ratios, upload steps, and review-window labels.

Rejected directions:
- Do not reduce the product to prompt optimization only.
- Do not flatten cognition state into chat history.
- Do not expose raw JSON as the default review surface.

CODEX PATCH DIRECTIVE
Below is a giant copied block that should not survive literally: do not copy this entire task wall, do not preserve upload chatter, and do not treat screenshot setup as workflow intelligence.`
    });
    const workflow = {
      ...buildWorkflowDraft(noisy, noisy.transformedText),
      id: "workflow_noisy",
      workflow_id: "workflow_noisy",
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z"
    };
    const capsule = {
      capsule_version: 1 as const,
      ...buildCapsuleDraft(noisy, noisy.transformedText),
      id: "capsule_noisy",
      capsule_id: "capsule_noisy",
      created_at: "2026-05-20T00:00:00.000Z",
      updated_at: "2026-05-20T00:00:00.000Z"
    };
    const context = {
      result: noisy,
      transformedText: noisy.transformedText,
      sessionState: null,
      extensionVersion: "2.2.1",
      currentUrl: "chrome-extension://review.html",
      workflow,
      capsule
    };
    const portableCapsule = buildPortableCapsuleArtifact(capsule, context);
    const diagnostic = buildDiagnosticState(context);
    const portableText = JSON.stringify({ workflow, capsule, portableCapsule });

    expect(workflow.active_objective).toContain("Prompt Accelerator continuity behavior");
    expect(workflow.active_objective).not.toBe("Hybrid Workspace");
    expect(workflow.stable_constraints?.join(" ")).toContain("workflow continuity");
    expect(portableText).not.toMatch(/uploading|Show more|SAVE button|Analyze everything|Product Hunt screenshot/i);
    expect(capsule.rejected_directions?.join(" ")).toContain("Do not reduce the product to prompt optimization only.");
    expect(capsule.rejected_directions?.join(" ")).toContain("Do not expose raw JSON as the default review surface.");
    expect(capsule.rejected_directions?.join(" ")).not.toMatch(/giant copied block|screenshot setup/i);
    expect(capsule.continuity_anchors?.join(" ")).toMatch(/Prompt Accelerator|Workflow|Capsule|Diagnostic|continuity/i);
    expect(String(portableCapsule.capsule_text).length).toBeLessThan(noisy.originalText.length);
    expect(portableCapsule).not.toHaveProperty("original_storage_record");
    expect(diagnostic.raw_capsule).toMatchObject({ id: "capsule_noisy" });
    expect((diagnostic.warnings as string[]).join(" ")).toMatch(/debris|objective normalized|compactness/i);
  });
});
