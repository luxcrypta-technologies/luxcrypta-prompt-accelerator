import type { SessionGovernanceState, SessionMonitors, SessionNoveltyItem, SessionOpennessState, SessionStableCore } from "@luxcrypta/continuity-types/governance";
import {
  composeContinuityHealth,
  healthFromScores,
  scoreCompressionDensity,
  scoreContinuity,
  scoreDrift,
  scoreMutationStability,
  scoreOpenness,
  scoreReplayFidelity
} from "./scoring";

function preservedStateLength(core: SessionStableCore, openness: SessionOpennessState): number {
  return [
    core.objective,
    ...core.hardConstraints,
    ...core.acceptedDecisions,
    core.outputContract ?? "",
    ...openness.openQuestions,
    ...openness.uncertaintyNotes,
    ...openness.optionalBranches
  ].join("\n").length;
}

function noveltyAgeDays(item: SessionNoveltyItem, timestamp: string): number {
  const start = Date.parse(item.lastSeenAt ?? item.createdAt);
  const end = Date.parse(timestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function computeSessionMonitors(input: {
  previousState?: SessionGovernanceState | null;
  stableCore: SessionStableCore;
  noveltyLane: SessionNoveltyItem[];
  opennessLane: SessionOpennessState;
  originalLength: number;
  mutationStats?: { cleanMutations: number; totalMutations: number };
}): SessionMonitors {
  const disruptiveNovelty = input.noveltyLane.filter(
    (item) => !item.accepted && (item.kind === "new_objective" || item.kind === "changed_constraint" || item.kind === "output_shift")
  ).length;
  const unresolvedNovelty = input.noveltyLane.filter((item) => !item.accepted);
  const repeatedNovelty = unresolvedNovelty.filter((item) => (item.seenCount ?? 1) >= 2).length;
  const agedNovelty = unresolvedNovelty.filter((item) => noveltyAgeDays(item, input.stableCore.lastUpdatedAt) >= 7).length;

  // nu — novelty load. Operates ONLY on the novelty lane; stable/ARC items are
  // never counted here (D7 fix: stable state must not inflate novelty).
  const noveltyLoad = Math.min(
    100,
    unresolvedNovelty.length * 10 + repeatedNovelty * 5 + agedNovelty * 8 + disruptiveNovelty * 8
  );

  const delta = Math.min(100, scoreDrift(input.previousState, input.stableCore) + disruptiveNovelty * 8);
  const omega = scoreOpenness(input.opennessLane);
  const rho = scoreReplayFidelity(input.stableCore, input.opennessLane);
  const mu = scoreMutationStability(input.mutationStats ?? { cleanMutations: 0, totalMutations: 0 });
  const baseContinuity = scoreContinuity(input.stableCore);
  const compressionDensity = scoreCompressionDensity(
    input.originalLength,
    preservedStateLength(input.stableCore, input.opennessLane)
  );

  // chi — composite continuity health. Blended so no single component saturates
  // the signal (fixes pinned-at-100). D8: over-block warnings do NOT enter here.
  const chi = composeContinuityHealth({
    baseContinuity,
    drift: delta,
    replay: rho,
    mutation: mu,
    noveltyLoad,
    openness: omega
  });

  const base = {
    continuityScore: chi,
    driftScore: delta,
    noveltyLoad,
    opennessScore: omega,
    compressionDensity,
    replayFidelity: rho,
    mutationStability: mu
  };

  return {
    ...base,
    sessionHealth: healthFromScores(base)
  };
}
