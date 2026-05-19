import type { SessionGovernanceState, SessionMonitors, SessionOpennessState, SessionStableCore } from "@luxcrypta/continuity-types/governance";
import { isMeaningfullySimilar } from "./stable-core";

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreContinuity(core: SessionStableCore): number {
  return clampScore(
    35 +
      (core.objective ? 20 : 0) +
      Math.min(24, core.hardConstraints.length * 5) +
      Math.min(18, core.acceptedDecisions.length * 4) +
      (core.outputContract ? 8 : 0) +
      (core.preferredMode ? 4 : 0)
  );
}

export function scoreOpenness(openness: SessionOpennessState): number {
  return clampScore(
    openness.openQuestions.length * 10 +
      openness.uncertaintyNotes.length * 8 +
      openness.optionalBranches.length * 8 +
      (openness.preservedCreativeSpace ? 20 : 0)
  );
}

export function scoreCompressionDensity(originalLength: number, preservedLength: number): number {
  if (originalLength <= 0) return 70;
  const ratio = preservedLength / originalLength;
  return clampScore(100 - ratio * 60);
}

export function scoreDrift(previous: SessionGovernanceState | null | undefined, core: SessionStableCore): number {
  if (!previous) return 5;
  let drift = 0;
  if (!isMeaningfullySimilar(previous.stableCore.objective, core.objective)) drift += 42;

  const previousConstraints = previous.stableCore.hardConstraints;
  const changedConstraints = previousConstraints.filter(
    (constraint) => !core.hardConstraints.some((next) => isMeaningfullySimilar(constraint, next))
  ).length;
  const addedConstraints = core.hardConstraints.filter(
    (constraint) => !previousConstraints.some((existing) => isMeaningfullySimilar(existing, constraint))
  ).length;
  drift += changedConstraints * 9 + addedConstraints * 4;

  if (
    previous.stableCore.outputContract &&
    core.outputContract &&
    !isMeaningfullySimilar(previous.stableCore.outputContract, core.outputContract)
  ) {
    drift += 18;
  }
  if (previous.stableCore.preferredMode && core.preferredMode && previous.stableCore.preferredMode !== core.preferredMode) {
    drift += 6;
  }
  return clampScore(drift);
}

export function healthFromScores(scores: Omit<SessionMonitors, "sessionHealth">): SessionMonitors["sessionHealth"] {
  if (scores.driftScore >= 65 || scores.continuityScore < 45 || (scores.noveltyLoad >= 80 && scores.driftScore >= 45)) {
    return "unstable";
  }
  if (scores.noveltyLoad >= 55 || scores.compressionDensity < 25) return "watch";
  if (scores.opennessScore < 15 && scores.continuityScore < 70) return "watch";
  return "healthy";
}
