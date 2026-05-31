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

/**
 * Replay fidelity (rho): similarity between the current durable state and a
 * re-derivation of it from its own components. High when the state reconstructs
 * cleanly; low when it has become internally inconsistent. Stage 1 uses a
 * structural proxy (round-trippable item ratio) rather than a full re-run.
 */
export function scoreReplayFidelity(core: SessionStableCore, openness: SessionOpennessState): number {
  const items = [
    core.objective,
    ...core.hardConstraints,
    ...core.acceptedDecisions,
    core.outputContract ?? "",
    ...openness.openQuestions
  ].filter((value) => value && value.trim().length > 0);
  if (items.length === 0) return 70;
  const reconstructable = items.filter((value) => value.trim().length >= 4 && !/^\W+$/.test(value)).length;
  return clampScore((reconstructable / items.length) * 100);
}

/**
 * Mutation stability (mu): admitted-clean / total mutations this turn.
 * Psi_t = C_t / |M_t|. High when admitted mutations are clean; low when many
 * mutations were rejected/quarantined relative to total.
 */
export function scoreMutationStability(input: { cleanMutations: number; totalMutations: number }): number {
  if (input.totalMutations <= 0) return 100;
  return clampScore((input.cleanMutations / input.totalMutations) * 100);
}

/**
 * Composite continuity health (chi): a scale-aware blend of the distinct
 * components so no single one can saturate the signal (fixes the pinned-100
 * pathology). Drift and replay are weighted highest (per design decision Q2);
 * novelty and openness contribute as load, not as the whole story.
 *
 * Weights are a documented, tunable policy block (see Stage 1 spec sec 0:
 * source math defines weights "set by policy", File 2 sec 3.3). Scale-aware
 * fixed defaults are a legitimate baseline (multi-task-learning literature:
 * uncertainty-weighted softmax matches brute-force grid search; we ship fixed
 * defaults tuned later rather than over-engineering adaptive weighting in v1).
 */
export const CHI_WEIGHTS = {
  baseContinuity: 0.3, // structural completeness of stable core
  drift: 0.25, // delta (inverted: low drift -> high health)
  replay: 0.25, // rho
  mutation: 0.12, // mu
  noveltyPenalty: 0.05, // nu (excess novelty erodes health)
  opennessPenalty: 0.03 // omega (excess unresolved load erodes health)
} as const;

export function composeContinuityHealth(input: {
  baseContinuity: number; // scoreContinuity(core)
  drift: number; // delta
  replay: number; // rho
  mutation: number; // mu
  noveltyLoad: number; // nu
  openness: number; // omega
}): number {
  const w = CHI_WEIGHTS;
  const value =
    w.baseContinuity * input.baseContinuity +
    w.drift * (100 - input.drift) +
    w.replay * input.replay +
    w.mutation * input.mutation -
    w.noveltyPenalty * Math.max(0, input.noveltyLoad - 50) -
    w.opennessPenalty * Math.max(0, input.openness - 70);
  return clampScore(value);
}
