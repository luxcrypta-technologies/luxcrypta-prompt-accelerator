import type { CarryForwardCapsule } from "@/types/capsules";
import type { TransformResult } from "@/types/prompts";
import type { Workflow } from "@/types/workflows";

type WorkflowDraft = Omit<Workflow, "id" | "createdAt" | "updatedAt">;
export type CapsuleDraft = Omit<CarryForwardCapsule, "capsule_version" | "id" | "created_at" | "updated_at">;

const MAX_TITLE_LENGTH = 72;

function cleanLine(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function uniqueNonEmpty(items: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const clean = cleanLine(item);
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    output.push(clean);
  }
  return output;
}

function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 3).trim()}...`;
}

export function titleFromObjective(objective: string | undefined, fallback: string): string {
  const clean = cleanLine(objective)
    .replace(/^active objective:\s*/i, "")
    .replace(/^objective:\s*/i, "");
  return truncate(clean || fallback, MAX_TITLE_LENGTH);
}

function bulletSection(title: string, items: string[], emptyText?: string): string[] {
  if (!items.length && !emptyText) return [];
  return [title, ...(items.length ? items.map((item) => `- ${item}`) : [`- ${emptyText}`])];
}

export function formatContinuityExport(result: TransformResult, transformedText: string): string {
  const review = result.continuityReview;
  const sections = [
    ["Continuity Review"],
    ["Active Objective", review.activeObjective],
    bulletSection("Stable Core", review.stableCore, "No stable constraints or accepted decisions detected."),
    bulletSection("New / Provisional", review.newProvisional, "No new provisional changes detected."),
    bulletSection("Open / Unresolved", review.openUnresolved),
    bulletSection("Recommended Next Actions", review.recommendedNextActions),
    transformedText.trim() ? ["Transformed Continuity Draft", transformedText.trim()] : []
  ];

  return sections
    .filter((section) => section.length)
    .map((section) => section.join("\n"))
    .join("\n\n");
}

export function buildWorkflowDraft(result: TransformResult, transformedText: string): WorkflowDraft {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const stableConstraints = uniqueNonEmpty([
    ...result.extractedConstraints.map((constraint) => constraint.text),
    ...(parsed?.stable_constraints ?? []),
    ...review.stableCore
  ]).slice(0, 12);
  const acceptedDecisions = uniqueNonEmpty([...(parsed?.accepted_decisions ?? []), ...review.whatChanged]).slice(0, 8);
  const title = titleFromObjective(review.activeObjective, "Continuity workflow");

  return {
    title,
    objective: cleanLine(review.activeObjective) || cleanLine(transformedText) || "Continue the reviewed prompt workflow.",
    mode: result.modeApplied ?? parsed?.preferred_mode ?? "precision",
    constraints: stableConstraints,
    outputPreferences: uniqueNonEmpty([
      ...result.explanation,
      ...acceptedDecisions.map((decision) => `Accepted decision: ${decision}`),
      ...review.recommendedNextActions.map((action) => `Next action: ${action}`)
    ]).slice(0, 16),
    carryForwardContext: formatContinuityExport(result, transformedText),
    targetModel: result.targetModelApplied,
    tags: uniqueNonEmpty(["continuity-review", result.targetModelApplied])
  };
}

export function buildCapsuleDraft(result: TransformResult, transformedText: string): CapsuleDraft {
  const review = result.continuityReview;
  const parsed = review.diagnostics.parsedCapsule;
  const title = `${titleFromObjective(review.activeObjective, "Continuity")} Capsule`;
  const constraints = uniqueNonEmpty([
    ...result.extractedConstraints.map((constraint) => constraint.text),
    ...(parsed?.stable_constraints ?? []),
    ...review.stableCore
  ]).slice(0, 12);
  const decisions = uniqueNonEmpty([...(parsed?.accepted_decisions ?? []), ...review.whatChanged]).slice(0, 10);
  const openQuestions = uniqueNonEmpty([
    ...(parsed?.open_questions ?? []),
    ...(parsed?.unresolved_risks ?? []),
    ...review.openUnresolved
  ]).slice(0, 10);
  const notes = [
    "Saved from Continuity Review.",
    review.cleanSummary,
    ...bulletSection("New / Provisional", review.newProvisional),
    ...bulletSection("Recommended Next Actions", review.recommendedNextActions),
    transformedText.trim() ? `Transformed Continuity Draft\n${transformedText.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title,
    objective: cleanLine(review.activeObjective) || cleanLine(transformedText) || "Continue the reviewed session.",
    constraints,
    decisions,
    open_questions: openQuestions,
    preferred_mode: result.modeApplied ?? parsed?.preferred_mode,
    notes,
    sourceSurface: review.diagnostics.sourceSurface ?? result.targetModelApplied
  };
}
