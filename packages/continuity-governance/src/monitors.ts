import type { SessionGovernanceState, SessionMonitors, SessionNoveltyItem, SessionOpennessState, SessionStableCore } from "@luxcrypta/continuity-types/governance";
import { healthFromScores, scoreCompressionDensity, scoreContinuity, scoreDrift, scoreOpenness } from "./scoring";

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
}): SessionMonitors {
  const disruptiveNovelty = input.noveltyLane.filter(
    (item) => !item.accepted && (item.kind === "new_objective" || item.kind === "changed_constraint" || item.kind === "output_shift")
  ).length;
  const unresolvedNovelty = input.noveltyLane.filter((item) => !item.accepted);
  const repeatedNovelty = unresolvedNovelty.filter((item) => (item.seenCount ?? 1) >= 2).length;
  const agedNovelty = unresolvedNovelty.filter((item) => noveltyAgeDays(item, input.stableCore.lastUpdatedAt) >= 7).length;
  const base = {
    continuityScore: scoreContinuity(input.stableCore),
    driftScore: Math.min(100, scoreDrift(input.previousState, input.stableCore) + disruptiveNovelty * 8),
    noveltyLoad: Math.min(100, unresolvedNovelty.length * 10 + repeatedNovelty * 5 + agedNovelty * 8 + disruptiveNovelty * 8),
    opennessScore: scoreOpenness(input.opennessLane),
    compressionDensity: scoreCompressionDensity(input.originalLength, preservedStateLength(input.stableCore, input.opennessLane))
  };

  return {
    ...base,
    sessionHealth: healthFromScores(base)
  };
}
