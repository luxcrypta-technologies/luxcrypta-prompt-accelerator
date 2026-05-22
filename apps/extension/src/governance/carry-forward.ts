import type { CarryForwardCapsule } from "@/types/capsules";
import type { SessionGovernanceState } from "@/types/governance";
import { createDatedId } from "@/utils/ids";

export function createCarryForwardFromGovernance(state: SessionGovernanceState): CarryForwardCapsule {
  return {
    capsule_version: 1,
    id: createDatedId("capsule", `${state.id}:${state.updatedAt}`, state.updatedAt),
    title: state.title ?? "Governed session carry-forward",
    objective: state.stableCore.objective,
    constraints: state.stableCore.hardConstraints.slice(0, 10),
    decisions: state.stableCore.acceptedDecisions.slice(0, 8),
    open_questions: state.opennessLane.openQuestions.slice(0, 8),
    governance_state: state.adversarialGovernance
      ? {
          trusted_state_summary: state.adversarialGovernance.conflict_report.trusted_summary,
          untrusted_instruction_summary: state.adversarialGovernance.conflict_report.untrusted_summary,
          conflict_report: state.adversarialGovernance.conflict_report,
          mutation_risk_report: state.adversarialGovernance.mutation_risk_report
        }
      : undefined,
    governance_principles: state.governancePrinciples?.slice(0, 8),
    invariants: state.invariants?.slice(0, 8),
    continuity_safeguards: state.continuitySafeguards?.slice(0, 8),
    quarantine_log: state.quarantineLog?.slice(0, 8),
    deferred_items: state.deferredItems?.slice(0, 8),
    mutation_targets: state.mutationTargets?.slice(0, 8),
    rejected_directions: state.rejectedDirections?.slice(0, 8),
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
