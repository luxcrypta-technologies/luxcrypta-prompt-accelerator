import type { SessionGovernanceState, SessionMonitors, SessionOpennessState, SessionStableCore } from "@/types/governance";

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreContinuity(core: SessionStableCore): number {
  return clampScore(42 + (core.objective ? 22 : 0) + core.hardConstraints.length * 4 + core.acceptedDecisions.length * 3);
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
  if (previous.stableCore.objective !== core.objective) drift += 40;
  const constraintDelta = Math.abs(previous.stableCore.hardConstraints.length - core.hardConstraints.length);
  drift += constraintDelta * 6;
  return clampScore(drift);
}

export function healthFromScores(scores: Omit<SessionMonitors, "sessionHealth">): SessionMonitors["sessionHealth"] {
  if (scores.driftScore >= 65 || scores.continuityScore < 45) return "unstable";
  if (scores.noveltyLoad >= 55 || scores.opennessScore < 15) return "watch";
  return "healthy";
}
