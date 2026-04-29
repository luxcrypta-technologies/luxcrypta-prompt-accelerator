import type { SessionGovernanceState, SessionMonitors, SessionNoveltyItem, SessionOpennessState, SessionStableCore } from "@/types/governance";
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

export function computeSessionMonitors(input: {
  previousState?: SessionGovernanceState | null;
  stableCore: SessionStableCore;
  noveltyLane: SessionNoveltyItem[];
  opennessLane: SessionOpennessState;
  originalLength: number;
}): SessionMonitors {
  const base = {
    continuityScore: scoreContinuity(input.stableCore),
    driftScore: scoreDrift(input.previousState, input.stableCore),
    noveltyLoad: Math.min(100, input.noveltyLane.filter((item) => !item.accepted).length * 12),
    opennessScore: scoreOpenness(input.opennessLane),
    compressionDensity: scoreCompressionDensity(input.originalLength, preservedStateLength(input.stableCore, input.opennessLane))
  };

  return {
    ...base,
    sessionHealth: healthFromScores(base)
  };
}
