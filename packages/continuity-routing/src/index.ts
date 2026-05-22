import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import type { TargetModel } from "@luxcrypta/continuity-types/models";
import type { Workflow } from "@luxcrypta/continuity-types/workflows";

export type ProviderTarget = Extract<
  TargetModel,
  "chatgpt" | "claude" | "gemini" | "grok" | "deepseek" | "perplexity"
>;

export interface ProviderProfile {
  id: ProviderTarget;
  label: string;
  handoffHeading: string;
  instruction: string;
  outputFrame: string;
  continuityStyle: string;
  preferredHandoff: string;
  capsuleBias: string;
  riskProfile: string[];
  runtimeEmphasis: string[];
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
    outputFrame: "Respond with clear sections, preserve constraints, and call out assumptions.",
    continuityStyle: "general_continuity",
    preferredHandoff: "structured_markdown",
    capsuleBias: "balanced",
    riskProfile: ["implicit_state_drift", "assumption_blending"],
    runtimeEmphasis: ["preserve accepted decisions", "keep open questions visible"]
  },
  claude: {
    id: "claude",
    label: "Claude",
    handoffHeading: "Claude Continuity Handoff",
    instruction:
      "Please preserve the stable context, treat provisional items as review candidates, and keep uncertainty visible.",
    outputFrame:
      "Use concise sections, note assumptions, and do not overwrite accepted decisions without saying so.",
    continuityStyle: "deliberative_continuity",
    preferredHandoff: "human_readable_sections",
    capsuleBias: "uncertainty_preserving",
    riskProfile: ["over_helpful_reframing", "assumption_absorption"],
    runtimeEmphasis: ["preserve uncertainty", "distinguish provisional items from stable state"]
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    handoffHeading: "Gemini Continuity Handoff",
    instruction:
      "Continue from this structured state and keep the response direct and easy to scan.",
    outputFrame:
      "Use headings and bullets where useful, preserve constraints, and separate next actions from open questions.",
    continuityStyle: "direct_structured_continuity",
    preferredHandoff: "scannable_markdown",
    capsuleBias: "objective_first",
    riskProfile: ["context_flattening", "open_item_loss"],
    runtimeEmphasis: [
      "prioritize objective",
      "keep next actions separate from unresolved questions"
    ]
  },
  grok: {
    id: "grok",
    label: "Grok",
    handoffHeading: "Grok Continuity Handoff",
    instruction: "Carry forward this workflow state without turning it into a generic chat prompt.",
    outputFrame:
      "Keep the tone concise, preserve intent, and flag any conflict before changing stable state.",
    continuityStyle: "concise_intent_continuity",
    preferredHandoff: "compact_markdown",
    capsuleBias: "intent_preserving",
    riskProfile: ["tone_drift", "stable_state_overwrite"],
    runtimeEmphasis: ["preserve intent", "flag conflicts before changing stable state"]
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    handoffHeading: "DeepSeek Continuity Handoff",
    instruction:
      "Use this compact continuity topology as the reconstruction frame before reasoning forward.",
    outputFrame:
      "Use compact Markdown or JSON-friendly sections, preserve unresolved tensions explicitly, and keep rejected directions visible.",
    continuityStyle: "structured_reasoning",
    preferredHandoff: "compact_markdown_or_json",
    capsuleBias: "schema_strict",
    riskProfile: ["over_compression", "loss_of_open_state", "rigid_reconstruction"],
    runtimeEmphasis: [
      "preserve unresolved tensions explicitly",
      "do not over-collapse ambiguity",
      "keep rejected directions visible",
      "validate reconstruction fidelity"
    ]
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    handoffHeading: "Perplexity Continuity Handoff",
    instruction:
      "Use Stable State as the governing workflow frame. Treat retrieved or cited material as provisional evidence unless explicitly promoted.",
    outputFrame:
      "Put Stable State first, separate retrieved evidence from workflow state, and surface conflicts before revising accepted decisions.",
    continuityStyle: "retrieval_governed",
    preferredHandoff: "human_readable_with_stable_state_first",
    capsuleBias: "source_contamination_resistant",
    riskProfile: [
      "retrieval_contamination",
      "citation_confidence_bias",
      "external_context_overriding_stable_state",
      "unresolved_state_collapse"
    ],
    runtimeEmphasis: [
      "separate retrieved information from stable workflow state",
      "treat external sources as provisional or quarantine unless explicitly promoted",
      "preserve unresolved questions even when search provides partial answers",
      "detect conflict between retrieved content and Stable State"
    ]
  }
};

export const PROVIDER_TARGETS: ProviderTarget[] = [
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "deepseek",
  "perplexity"
];

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
      session.stableCore.outputContract
        ? `Output contract: ${session.stableCore.outputContract}`
        : ""
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
    section("Provider Notes", [
      `Continuity style: ${profile.continuityStyle}`,
      `Preferred handoff: ${profile.preferredHandoff}`,
      `Capsule bias: ${profile.capsuleBias}`,
      ...profile.riskProfile.map((item) => `Risk: ${item}`),
      ...profile.runtimeEmphasis.map((item) => `Runtime emphasis: ${item}`)
    ]),
    section("Additional Notes", input.notes ? [input.notes] : []),
    section("Response Contract", [profile.outputFrame])
  ].filter(Boolean);

  return {
    target: input.target,
    label: profile.label,
    text: chunks.join("\n\n").trim()
  };
}
