import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import { createDatedId } from "@luxcrypta/continuity-types/utils/ids";

const PROMPT_SHELL_RE =
  /^(?:user|assistant|system|developer|active objective|objective|stable constraints|accepted decisions|rejected directions|open\s*\/\s*unresolved|governance principles|invariants|continuity safeguards):?$|(?:return exactly|copy this final prompt only|do not turn this into a paragraph|keep sections separate\s+rejected directions)/i;
const SECTION_LABEL_RE =
  /\b(active objective|stable constraints|accepted decisions|rejected directions|open\s*\/\s*unresolved|governance principles|invariants|continuity safeguards)\b/i;

function cleanCarryForwardItem(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isCarryForwardShell(value: string | undefined): boolean {
  const clean = cleanCarryForwardItem(value);
  if (!clean || PROMPT_SHELL_RE.test(clean)) return true;
  const labelMatch = clean.match(SECTION_LABEL_RE);
  if (!labelMatch?.index) return false;
  const beforeLabel = clean.slice(0, labelMatch.index).trim();
  return Boolean(beforeLabel && !/[:.;!?]$/.test(beforeLabel));
}

function cleanCarryForwardItems(items: string[] | undefined, limit: number): string[] {
  return (items ?? [])
    .map(cleanCarryForwardItem)
    .filter((item) => !isCarryForwardShell(item))
    .slice(0, limit);
}

export function createCarryForwardFromGovernance(state: SessionGovernanceState): CarryForwardCapsule {
  const objective = isCarryForwardShell(state.stableCore.objective)
    ? "invalid_objective"
    : cleanCarryForwardItem(state.stableCore.objective);
  const constraints = cleanCarryForwardItems(state.stableCore.hardConstraints, 10);
  const decisions = cleanCarryForwardItems(state.stableCore.acceptedDecisions, 8);
  const openQuestions = cleanCarryForwardItems(state.opennessLane.openQuestions, 8);
  const governancePrinciples = cleanCarryForwardItems(state.governancePrinciples, 8);
  const invariants = cleanCarryForwardItems(state.invariants, 8);
  const continuitySafeguards = cleanCarryForwardItems(state.continuitySafeguards, 8);
  const rejectedDirections = cleanCarryForwardItems(state.rejectedDirections, 8);
  const rawDurableItems = [
    state.stableCore.objective,
    ...state.stableCore.hardConstraints,
    ...state.stableCore.acceptedDecisions,
    ...state.opennessLane.openQuestions,
    ...(state.governancePrinciples ?? []),
    ...(state.invariants ?? []),
    ...(state.continuitySafeguards ?? []),
    ...(state.rejectedDirections ?? [])
  ].filter(Boolean);
  const durableCount = [
    objective === "invalid_objective" ? "" : objective,
    ...constraints,
    ...decisions,
    ...openQuestions,
    ...governancePrinciples,
    ...invariants,
    ...continuitySafeguards,
    ...rejectedDirections
  ].filter(Boolean).length;

  return {
    capsule_version: 1,
    id: createDatedId("capsule", `${state.id}:${state.updatedAt}`, state.updatedAt),
    title: state.title ?? "Governed session carry-forward",
    objective,
    active_objective: objective,
    constraints,
    stable_constraints: constraints,
    decisions,
    accepted_decisions: decisions,
    open_questions: openQuestions,
    unresolved_issues: openQuestions,
    governance_state: state.adversarialGovernance
      ? {
          trusted_state_summary: state.adversarialGovernance.conflict_report.trusted_summary,
          untrusted_instruction_summary: state.adversarialGovernance.conflict_report.untrusted_summary,
          conflict_report: state.adversarialGovernance.conflict_report,
          mutation_risk_report: state.adversarialGovernance.mutation_risk_report
        }
      : undefined,
    governance_principles: governancePrinciples,
    invariants,
    continuity_safeguards: continuitySafeguards,
    quarantine_log: cleanCarryForwardItems(state.quarantineLog, 8),
    deferred_items: cleanCarryForwardItems(state.deferredItems, 8),
    mutation_targets: state.mutationTargets?.slice(0, 8),
    rejected_directions: rejectedDirections,
    diagnostic_metadata: {
      export_source_mode: "session_durable_state",
      session_durable_item_count: durableCount,
      latest_turn_durable_item_count: 0,
      durable_items_carried_forward_count: durableCount,
      durable_items_overridden_by_latest_turn_count: 0,
      session_items_considered_count: rawDurableItems.length,
      session_items_admitted_count: durableCount,
      session_items_rejected_as_shell_count: Math.max(0, rawDurableItems.length - durableCount),
      fallback_to_latest_turn_only: false,
      session_level_capsule_passed: objective !== "invalid_objective"
    },
    preferred_mode: state.stableCore.preferredMode,
    notes: [
      state.opennessLane.uncertaintyNotes.length
        ? `Uncertainty preserved: ${state.opennessLane.uncertaintyNotes.slice(0, 3).join("; ")}`
        : "",
      state.noveltyLane.length ? `${state.noveltyLane.length} provisional item(s) still need review.` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    created_at: state.updatedAt,
    updated_at: state.updatedAt
  };
}
