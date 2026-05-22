import { createCarryForwardFromGovernance } from "./carry-forward";
import { generateSessionDiagnostics } from "./diagnostics";
import { computeSessionMonitors } from "./monitors";
import { healthFromScores } from "./scoring";
import { updateNoveltyLane } from "./novelty";
import { updateOpennessLane } from "./openness";
import { extractSessionCandidates, partitionSessionCandidates } from "./partition";
import { updateStableCore } from "./stable-core";
import type {
  SessionGovernanceState,
  SessionUpdateInput,
  SessionUpdateResult
} from "@/types/governance";
import type { AdversarialGovernanceState } from "@/types/prompts";
import { firstMeaningfulLine } from "@/utils/text";
import { nowIso } from "@/utils/time";

function originalLength(input: SessionUpdateInput): number {
  return (
    input.transformRequest?.sourceText.length ??
    input.transformResult?.originalText.length ??
    input.capsule?.objective.length ??
    input.conversationSnapshot?.turns.map((turn) => turn.text).join("\n").length ??
    0
  );
}

function fallbackText(input: SessionUpdateInput): string {
  return (
    input.transformRequest?.sourceText ??
    input.transformResult?.transformedText ??
    input.capsule?.objective ??
    input.conversationSnapshot?.turns.map((turn) => turn.text).join("\n") ??
    ""
  );
}

function titleFor(
  input: SessionUpdateInput,
  state: SessionGovernanceState | null | undefined,
  text: string
): string | undefined {
  return (
    state?.title ??
    input.conversationSnapshot?.title ??
    firstMeaningfulLine(text, "").slice(0, 80) ??
    undefined
  );
}

function uniqueMerged(
  previous: string[] | undefined,
  next: string[] | undefined
): string[] | undefined {
  const merged = [...(previous ?? []), ...(next ?? [])].map((item) => item.trim()).filter(Boolean);
  return merged.length ? Array.from(new Set(merged)).slice(0, 16) : undefined;
}

function monitorsWithAdmissionPenalties(
  monitors: ReturnType<typeof computeSessionMonitors>,
  governance: AdversarialGovernanceState | undefined,
  stableCoreSize: number
): ReturnType<typeof computeSessionMonitors> {
  if (!governance) return monitors;
  const warnings = governance.metric_warnings.join("\n");
  let continuityPenalty = 0;
  let driftPenalty = 0;
  if (/empty-state collapse|governance loss|invariant loss/i.test(warnings))
    continuityPenalty += 24;
  if (
    /page chrome|assistant-authored|field contamination|prompt scaffolding|task-local/i.test(
      warnings
    )
  )
    continuityPenalty += 18;
  if (/bucket overlap|rejected-direction|category header/i.test(warnings)) {
    continuityPenalty += 14;
    driftPenalty += 10;
  }
  if (
    !stableCoreSize &&
    (governance.governance_principles.length || governance.invariants.length)
  ) {
    continuityPenalty += 10;
  }
  if (!continuityPenalty && !driftPenalty) return monitors;
  const base = {
    continuityScore: Math.max(0, monitors.continuityScore - continuityPenalty),
    driftScore: Math.min(100, monitors.driftScore + driftPenalty),
    noveltyLoad: monitors.noveltyLoad,
    opennessScore: monitors.opennessScore,
    compressionDensity: monitors.compressionDensity
  };
  return {
    ...base,
    sessionHealth: healthFromScores(base)
  };
}

export function updateSessionGovernance(input: SessionUpdateInput): SessionUpdateResult {
  const timestamp = nowIso();
  const previous = input.previousState ?? null;
  const candidates = extractSessionCandidates(input);
  const partition = partitionSessionCandidates(candidates);
  const text = fallbackText(input);
  const preferredMode =
    input.transformRequest?.mode ??
    input.transformResult?.modeApplied ??
    input.capsule?.preferred_mode;
  const preferredTargetModel =
    input.transformRequest?.targetModel ?? input.transformResult?.targetModelApplied;
  const stableCore = updateStableCore({
    previous: previous?.stableCore,
    stableCandidates: partition.stableCandidates,
    fallbackText: text,
    preferredMode,
    preferredTargetModel,
    conservativeUpdates: input.conservativeStableCoreUpdates,
    timestamp
  });
  const opennessLane = updateOpennessLane({
    previous: previous?.opennessLane,
    opennessCandidates: partition.opennessCandidates,
    preferredMode,
    preserveOpenQuestions: input.preserveOpenQuestions ?? true,
    timestamp
  });
  const noveltyLane = updateNoveltyLane({
    previous: previous?.noveltyLane ?? [],
    candidates: partition.noveltyCandidates,
    stableCore,
    timestamp
  });
  const adversarialGovernance =
    input.transformResult?.continuityReview.diagnostics.adversarialGovernance;
  const monitors = monitorsWithAdmissionPenalties(
    computeSessionMonitors({
      previousState: previous,
      stableCore,
      noveltyLane,
      opennessLane,
      originalLength: originalLength(input)
    }),
    adversarialGovernance,
    stableCore.hardConstraints.length + stableCore.acceptedDecisions.length
  );
  const baseState: Omit<SessionGovernanceState, "diagnostics"> = {
    id:
      previous?.id ??
      `session_${
        stableCore.objective
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .slice(0, 36) || "active"
      }`,
    title: titleFor(input, previous, text),
    stableCore,
    noveltyLane,
    opennessLane,
    governancePrinciples: uniqueMerged(
      previous?.governancePrinciples,
      adversarialGovernance?.governance_principles
    ),
    invariants: uniqueMerged(previous?.invariants, adversarialGovernance?.invariants),
    continuitySafeguards: uniqueMerged(
      previous?.continuitySafeguards,
      adversarialGovernance?.continuity_safeguards
    ),
    rejectedDirections: uniqueMerged(
      previous?.rejectedDirections,
      adversarialGovernance?.rejected_directions
    ),
    quarantineLog: uniqueMerged(previous?.quarantineLog, adversarialGovernance?.quarantine_log),
    deferredItems: uniqueMerged(
      previous?.deferredItems,
      adversarialGovernance?.deferred_items.map((item) => item.text)
    ),
    mutationTargets: adversarialGovernance?.mutation_targets.length
      ? adversarialGovernance.mutation_targets
      : previous?.mutationTargets,
    adversarialGovernance: adversarialGovernance ?? previous?.adversarialGovernance,
    monitors,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp
  };
  const state: SessionGovernanceState = {
    ...baseState,
    diagnostics: generateSessionDiagnostics(baseState, timestamp)
  };

  return {
    state,
    carryForwardCandidate: createCarryForwardFromGovernance(state)
  };
}
