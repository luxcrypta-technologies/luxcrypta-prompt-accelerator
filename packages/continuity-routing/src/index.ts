import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import type { TargetModel } from "@luxcrypta/continuity-types/models";
import type { Workflow } from "@luxcrypta/continuity-types/workflows";

export type ProviderTarget = Extract<TargetModel, "chatgpt" | "claude" | "gemini" | "grok">;

export interface ProviderProfile {
  id: ProviderTarget;
  label: string;
  handoffHeading: string;
  instruction: string;
  outputFrame: string;
}

export interface ContinuityHandoffInput {
  target: ProviderTarget;
  session?: SessionGovernanceState | null;
  capsule?: CarryForwardCapsule | null;
  workflow?: Workflow | null;
  notes?: string;
}

export interface ContinuityHandoff {
  target: ProviderTarget;
  label: string;
  text: string;
}

export const PROVIDER_PROFILES: Record<ProviderTarget, ProviderProfile> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    handoffHeading: "ChatGPT Continuity Handoff",
    instruction: "Use the continuity state below as the working frame for the next response.",
    outputFrame: "Respond with clear sections, preserve constraints, and call out assumptions."
  },
  claude: {
    id: "claude",
    label: "Claude",
    handoffHeading: "Claude Continuity Handoff",
    instruction: "Please preserve the stable context, treat provisional items as review candidates, and keep uncertainty visible.",
    outputFrame: "Use concise sections, note assumptions, and do not overwrite accepted decisions without saying so."
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    handoffHeading: "Gemini Continuity Handoff",
    instruction: "Continue from this structured state and keep the response direct and easy to scan.",
    outputFrame: "Use headings and bullets where useful, preserve constraints, and separate next actions from open questions."
  },
  grok: {
    id: "grok",
    label: "Grok",
    handoffHeading: "Grok Continuity Handoff",
    instruction: "Carry forward this workflow state without turning it into a generic chat prompt.",
    outputFrame: "Keep the tone concise, preserve intent, and flag any conflict before changing stable state."
  }
};

export const PROVIDER_TARGETS: ProviderTarget[] = ["chatgpt", "claude", "gemini", "grok"];

function section(title: string, lines: string[]): string {
  const content = lines.map((line) => line.trim()).filter(Boolean);
  if (!content.length) return "";
  return [`## ${title}`, ...content.map((line) => `- ${line}`)].join("\n");
}

function oneLine(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function capsuleLines(capsule: CarryForwardCapsule | null | undefined): string[] {
  if (!capsule) return [];
  return [
    `Capsule: ${capsule.title}`,
    `Objective: ${capsule.objective}`,
    ...capsule.constraints.map((item) => `Constraint: ${item}`),
    ...capsule.decisions.map((item) => `Decision: ${item}`),
    ...capsule.open_questions.map((item) => `Open question: ${item}`),
    capsule.notes ? `Notes: ${capsule.notes}` : ""
  ];
}

function workflowLines(workflow: Workflow | null | undefined): string[] {
  if (!workflow) return [];
  return [
    `Workflow: ${workflow.title}`,
    `Objective: ${workflow.objective}`,
    workflow.targetModel ? `Preferred target: ${workflow.targetModel}` : "",
    ...workflow.constraints.map((item) => `Constraint: ${item}`),
    ...workflow.outputPreferences.map((item) => `Output preference: ${item}`),
    workflow.carryForwardContext ? `Carry-forward context: ${workflow.carryForwardContext}` : ""
  ];
}

function sessionSections(session: SessionGovernanceState | null | undefined): string[] {
  if (!session) return [];
  return [
    section("Stable State", [
      `Objective: ${session.stableCore.objective}`,
      ...session.stableCore.hardConstraints.map((item) => `Hard constraint: ${item}`),
      ...session.stableCore.acceptedDecisions.map((item) => `Accepted decision: ${item}`),
      session.stableCore.outputContract ? `Output contract: ${session.stableCore.outputContract}` : ""
    ]),
    section(
      "Provisional State",
      session.noveltyLane
        .filter((item) => !item.accepted)
        .map((item) => `${item.kind.replace(/_/g, " ")}: ${item.text}`)
    ),
    section("Open State", [
      ...session.opennessLane.openQuestions.map((item) => `Question: ${item}`),
      ...session.opennessLane.uncertaintyNotes.map((item) => `Uncertainty: ${item}`),
      ...session.opennessLane.optionalBranches.map((item) => `Optional branch: ${item}`)
    ]),
    section("Continuity Health", [
      `Session health: ${session.monitors.sessionHealth}`,
      `Continuity score: ${session.monitors.continuityScore}`,
      `Drift score: ${session.monitors.driftScore}`,
      `Novelty load: ${session.monitors.noveltyLoad}`,
      `Openness score: ${session.monitors.opennessScore}`
    ])
  ].filter(Boolean);
}

export function buildContinuityHandoff(input: ContinuityHandoffInput): ContinuityHandoff {
  const profile = PROVIDER_PROFILES[input.target];
  const title =
    input.session?.title ??
    input.capsule?.title ??
    input.workflow?.title ??
    "LuxCrypta continuity handoff";
  const chunks = [
    `# ${profile.handoffHeading}`,
    profile.instruction,
    "",
    `Working title: ${oneLine(title, "Untitled workflow")}`,
    "",
    ...sessionSections(input.session),
    section("Capsule", capsuleLines(input.capsule)),
    section("Workflow", workflowLines(input.workflow)),
    section("Additional Notes", input.notes ? [input.notes] : []),
    section("Response Contract", [profile.outputFrame])
  ].filter(Boolean);

  return {
    target: input.target,
    label: profile.label,
    text: chunks.join("\n\n").trim()
  };
}
