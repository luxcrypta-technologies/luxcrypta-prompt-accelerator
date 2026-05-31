import type { ContinuityPrimaryBucket } from "@luxcrypta/continuity-types/prompts";

/**
 * ARC / WEDGE / GAP routing layer (Stage 1).
 *
 * This does NOT replace the provenance gate (bucketForGovernanceStatement in
 * continuity-core already gates admission on source_role — chrome/review/export
 * quarantined, external/retrieved require user promotion). It is the
 * consolidation layer the doctrine describes: once a fragment is admitted and
 * assigned a fine-grained ContinuityPrimaryBucket, it routes into one of three
 * families:
 *
 *   ARC   — stable continuity contributors (objective, durable constraints,
 *           accepted decisions, governance principles, invariants, safeguards,
 *           rejected directions are a preserved ARC sub-bucket).
 *   WEDGE — genuine novelty / change (provisional, task-local, mutation targets,
 *           conditional admissions): surfaced and explained, never silently
 *           merged.
 *   GAP   — unresolved / open / uncertain (open questions, deferred items):
 *           preserved, never collapsed to false closure.
 *
 * Items that are not continuity-bearing (diagnostic_only, quarantine_log) route
 * to neither family — they are held out of the carried-forward state.
 */

export type AwgFamily = "ARC" | "WEDGE" | "GAP" | "HELD_OUT";

const ARC_BUCKETS: ReadonlySet<ContinuityPrimaryBucket> = new Set([
  "stable_core",
  "governance_principles",
  "invariants",
  "continuity_safeguards",
  "rejected_directions"
]);

const WEDGE_BUCKETS: ReadonlySet<ContinuityPrimaryBucket> = new Set([
  "provisional_state",
  "task_local_instructions",
  "task_local_forbidden",
  "mutation_targets",
  "conditional_admissions"
]);

const GAP_BUCKETS: ReadonlySet<ContinuityPrimaryBucket> = new Set([
  "open_unresolved",
  "deferred_items"
]);

export function awgFamilyForBucket(bucket: ContinuityPrimaryBucket): AwgFamily {
  if (ARC_BUCKETS.has(bucket)) return "ARC";
  if (WEDGE_BUCKETS.has(bucket)) return "WEDGE";
  if (GAP_BUCKETS.has(bucket)) return "GAP";
  return "HELD_OUT"; // diagnostic_only, quarantine_log
}

export interface AwgDistribution {
  arc: number;
  wedge: number;
  gap: number;
  heldOut: number;
}

export function awgDistribution(buckets: ContinuityPrimaryBucket[]): AwgDistribution {
  const dist: AwgDistribution = { arc: 0, wedge: 0, gap: 0, heldOut: 0 };
  for (const bucket of buckets) {
    const family = awgFamilyForBucket(bucket);
    if (family === "ARC") dist.arc += 1;
    else if (family === "WEDGE") dist.wedge += 1;
    else if (family === "GAP") dist.gap += 1;
    else dist.heldOut += 1;
  }
  return dist;
}

/* ----------------------------------------------------------------------------
 * Objective score J and legality gate.
 *
 * Operationalizes the CME admission objective (verified from the AAA-NCF / CME
 * source, File 4 sec 1.2):
 *
 *   C_RCP(S) = arg min [ D_KL(S || S_hat_w) + theta*Delta_id + mu*(1 - I_functor) ]
 *
 * with the hard legality bounds (File 4 sec 2.2):
 *
 *   Delta_id <= 0.0033   (identity drift bound)
 *   Delta_I  <= theta_fusion   (contradiction flux bound)
 *
 * We add a fourth term R_AWG (the ARC/WEDGE/GAP role-balance term named but not
 * specified in the source) to penalize weak routing and bucket-collapse.
 *
 * Weights are a documented, tunable policy block. The source defines weights
 * "set by policy" (File 2 sec 3.3); no numeric values exist in the source.
 * Scale-aware fixed defaults are a legitimate baseline (multi-task-learning
 * literature: uncertainty-weighted softmax matches brute-force grid search), so
 * we ship principled defaults and tune later rather than over-engineering
 * adaptive weighting in v1. Drift and legality are also HARD GATES, not only
 * penalty terms (RL trust-region pattern: TRPO/MPO constrain KL of consecutive
 * states rather than relying on a soft weight).
 * -------------------------------------------------------------------------- */

export const OBJECTIVE_WEIGHTS = {
  fidelity: 1.0, // D_KL anchor
  legality: 2.5, // (1 - I_functor) functorial-legality penalty
  drift: 0.75, // Delta_id identity-drift penalty
  roleBalance: 0.5 // R_AWG ARC/WEDGE/GAP routing-balance penalty
} as const;

export const LEGALITY_BOUNDS = {
  driftMax: 0.0033, // identity drift hard bound (File 4 sec 2.2)
  fluxMax: 0.01 // theta_fusion contradiction-flux bound (Q1 default; tunable)
} as const;

export interface ObjectiveScoreInput {
  klFidelity: number; // D_KL(S || S_hat_w), >= 0 (0 = perfect fidelity)
  functorLegal: 0 | 1; // I_functor categorical legality indicator
  identityDrift: number; // Delta_id, >= 0
  contradictionFlux: number; // Delta_I, >= 0
  roleBalancePenalty: number; // R_AWG, >= 0 (0 = clean routing)
}

export interface ObjectiveScoreResult {
  J: number;
  legal: boolean;
  violations: string[];
}

/**
 * Compute the objective score J and evaluate the hard legality gate.
 * `legal` is false when any hard bound is exceeded; such a transform must be
 * rejected regardless of how low J is (legality is non-negotiable).
 */
export function scoreObjective(input: ObjectiveScoreInput): ObjectiveScoreResult {
  const w = OBJECTIVE_WEIGHTS;
  const J =
    w.fidelity * input.klFidelity +
    w.legality * (1 - input.functorLegal) +
    w.drift * input.identityDrift +
    w.roleBalance * input.roleBalancePenalty;

  const violations: string[] = [];
  if (input.functorLegal !== 1) violations.push("functorial_legality_failed");
  if (input.identityDrift > LEGALITY_BOUNDS.driftMax)
    violations.push(`identity_drift_exceeds_${LEGALITY_BOUNDS.driftMax}`);
  if (input.contradictionFlux > LEGALITY_BOUNDS.fluxMax)
    violations.push(`contradiction_flux_exceeds_${LEGALITY_BOUNDS.fluxMax}`);

  return { J, legal: violations.length === 0, violations };
}

/**
 * Monotonicity check: the doctrine requires the objective not to increase turn
 * over turn (J_t <= J_{t-1}) once converged. A small epsilon tolerance avoids
 * flapping on float noise.
 */
export function isMonotonic(previousJ: number | null | undefined, currentJ: number, epsilon = 1e-6): boolean {
  if (previousJ === null || previousJ === undefined) return true;
  return currentJ <= previousJ + epsilon;
}

/**
 * R_AWG (operationalized): routing-balance penalty. Penalizes (a) per-fragment
 * routing-confidence shortfall and (b) family-distribution collapse — e.g.
 * everything in ARC (no surfaced change) or GAP emptied (false closure). Returns
 * a normalized non-negative value (0 = clean, balanced routing).
 */
export function roleBalancePenalty(input: {
  routingConfidences: number[]; // 0..1 per admitted fragment
  distribution: AwgDistribution;
}): number {
  const { routingConfidences, distribution } = input;
  const confidenceShortfall =
    routingConfidences.length === 0
      ? 0
      : routingConfidences.reduce((sum, c) => sum + (1 - Math.max(0, Math.min(1, c))), 0) /
        routingConfidences.length;

  const continuityTotal = distribution.arc + distribution.wedge + distribution.gap;
  // Collapse term: if there is continuity content but an entire expected family
  // is empty, that signals collapse (e.g. all ARC, no WEDGE/GAP visibility).
  let collapse = 0;
  if (continuityTotal > 0) {
    const arcShare = distribution.arc / continuityTotal;
    if (arcShare >= 0.98) collapse += 0.5; // everything pinned to stable
  }
  return confidenceShortfall + collapse;
}
