import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import { createDatedId } from "@luxcrypta/continuity-types/utils/ids";

export function createCarryForwardFromGovernance(state: SessionGovernanceState): CarryForwardCapsule {
  return {
    capsule_version: 1,
    id: createDatedId("capsule", `${state.id}:${state.updatedAt}`, state.updatedAt),
    title: state.title ?? "Governed session carry-forward",
    objective: state.stableCore.objective,
    constraints: state.stableCore.hardConstraints.slice(0, 10),
    decisions: state.stableCore.acceptedDecisions.slice(0, 8),
    open_questions: state.opennessLane.openQuestions.slice(0, 8),
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
