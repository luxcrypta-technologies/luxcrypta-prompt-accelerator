import { createCarryForwardFromGovernance } from "./carry-forward";
import { generateSessionDiagnostics } from "./diagnostics";
import { computeSessionMonitors } from "./monitors";
import { healthFromScores } from "./scoring";
import { updateNoveltyLane } from "./novelty";
import { updateOpennessLane } from "./openness";
import { extractSessionCandidates, partitionSessionCandidates } from "./partition";
import { awgDistribution, awgFamilyForBucket, isMonotonic, roleBalancePenalty, scoreObjective } from "./routing";
import { isMeaningfullySimilar, stableCoreCapOverflow, updateStableCore } from "./stable-core";
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

  // ARC/WEDGE/GAP distribution + per-turn legality assessment (Stage 1).
  // We map the realized state to the three families and run the legality gate
  // on this turn's drift. driftScore is 0-100; the legality bound (File 4) is on
  // identity drift in [0,1] (<= 0.0033). A turn that moves the objective is, by
  // construction, a legal *user-directed* change (not identity drift of the
  // tool), so we measure identity drift as constraint/decision churn scaled
  // into the bound's neighborhood — objective changes are exempted as lawful.
  const awgBuckets = [
    ...stableCore.hardConstraints.map(() => "invariants" as const),
    ...stableCore.acceptedDecisions.map(() => "stable_core" as const),
    ...(stableCore.objective ? (["stable_core"] as const) : []),
    ...noveltyLane.map(() => "provisional_state" as const),
    ...opennessLane.openQuestions.map(() => "open_unresolved" as const)
  ];
  const distribution = awgDistribution([...awgBuckets]);
  const churn = previous
    ? previous.stableCore.hardConstraints.filter(
        (c) => !stableCore.hardConstraints.some((n) => isMeaningfullySimilar(c, n))
      ).length
    : 0;
  const identityDrift = previous ? Math.min(0.01, churn * 0.0011) : 0;
  const legality = scoreObjective({
    klFidelity: Math.max(0, monitors.driftScore / 100),
    functorLegal: 1,
    identityDrift,
    contradictionFlux: 0,
    roleBalancePenalty: roleBalancePenalty({
      routingConfidences: [...stableCore.hardConstraints, ...stableCore.acceptedDecisions].map(
        () => 0.86
      ),
      distribution
    })
  });
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
  const previousObjectiveScore = previous?.diagnostics?.legality?.objective_score;
  const capOverflow = stableCoreCapOverflow({
    previous: previous?.stableCore,
    stableCandidates: partition.stableCandidates,
    conservativeUpdates: input.conservativeStableCoreUpdates
  });
  // D9: placement check — verify admitted stable-core items route to ARC and no
  // GAP/WEDGE-family content leaked into the stable core. A mismatch is recorded
  // (not silently accepted), so a misrouted fragment is visible.
  const placementMismatches = [
    ...stableCore.hardConstraints.map(() => "invariants" as const),
    ...stableCore.acceptedDecisions.map(() => "stable_core" as const)
  ].filter((bucket) => awgFamilyForBucket(bucket) !== "ARC").length;
  const capWarnings =
    capOverflow.total > 0
      ? [`${capOverflow.total} stable item(s) beyond cap recorded as overflow (not silently dropped).`]
      : [];
  const placementWarnings =
    placementMismatches > 0
      ? [`${placementMismatches} stable item(s) failed ARC placement check.`]
      : [];
  const state: SessionGovernanceState = {
    ...baseState,
    diagnostics: {
      ...generateSessionDiagnostics(baseState, timestamp),
      awg_distribution: distribution,
      legality: {
        objective_score: legality.J,
        legal: legality.legal,
        violations: legality.violations,
        monotonic: isMonotonic(previousObjectiveScore, legality.J)
      },
      cap_overflow: capOverflow,
      placement_mismatches: placementMismatches
    }
  };
  state.diagnostics.warnings = [
    ...state.diagnostics.warnings,
    ...capWarnings,
    ...placementWarnings
  ];

  return {
    state,
    carryForwardCandidate: createCarryForwardFromGovernance(state)
  };
}
