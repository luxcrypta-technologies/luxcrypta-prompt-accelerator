import { describe, expect, it } from "vitest";
import {
  awgFamilyForBucket,
  awgDistribution,
  scoreObjective,
  isMonotonic,
  roleBalancePenalty,
  LEGALITY_BOUNDS
} from "@luxcrypta/continuity-governance/routing";

describe("ARC/WEDGE/GAP routing", () => {
  it("maps stable kinds to ARC", () => {
    expect(awgFamilyForBucket("stable_core")).toBe("ARC");
    expect(awgFamilyForBucket("governance_principles")).toBe("ARC");
    expect(awgFamilyForBucket("invariants")).toBe("ARC");
    expect(awgFamilyForBucket("rejected_directions")).toBe("ARC");
  });
  it("maps novelty/change kinds to WEDGE", () => {
    expect(awgFamilyForBucket("provisional_state")).toBe("WEDGE");
    expect(awgFamilyForBucket("task_local_instructions")).toBe("WEDGE");
    expect(awgFamilyForBucket("mutation_targets")).toBe("WEDGE");
  });
  it("maps unresolved kinds to GAP", () => {
    expect(awgFamilyForBucket("open_unresolved")).toBe("GAP");
    expect(awgFamilyForBucket("deferred_items")).toBe("GAP");
  });
  it("holds out non-continuity kinds", () => {
    expect(awgFamilyForBucket("diagnostic_only")).toBe("HELD_OUT");
    expect(awgFamilyForBucket("quarantine_log")).toBe("HELD_OUT");
  });
  it("computes a family distribution", () => {
    const dist = awgDistribution(["stable_core", "stable_core", "open_unresolved", "quarantine_log"]);
    expect(dist).toEqual({ arc: 2, wedge: 0, gap: 1, heldOut: 1 });
  });
});

describe("objective score J and legality gate", () => {
  it("is legal and low-J for a clean, faithful, legal transform", () => {
    const r = scoreObjective({
      klFidelity: 0.02,
      functorLegal: 1,
      identityDrift: 0.001,
      contradictionFlux: 0.001,
      roleBalancePenalty: 0.05
    });
    expect(r.legal).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.J).toBeGreaterThan(0);
  });

  it("rejects on functorial legality failure regardless of low J", () => {
    const r = scoreObjective({
      klFidelity: 0,
      functorLegal: 0,
      identityDrift: 0,
      contradictionFlux: 0,
      roleBalancePenalty: 0
    });
    expect(r.legal).toBe(false);
    expect(r.violations).toContain("functorial_legality_failed");
  });

  it("rejects when identity drift exceeds the 0.0033 hard bound", () => {
    const r = scoreObjective({
      klFidelity: 0.01,
      functorLegal: 1,
      identityDrift: LEGALITY_BOUNDS.driftMax + 0.001,
      contradictionFlux: 0,
      roleBalancePenalty: 0
    });
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.startsWith("identity_drift_exceeds"))).toBe(true);
  });

  it("rejects when contradiction flux exceeds theta_fusion", () => {
    const r = scoreObjective({
      klFidelity: 0.01,
      functorLegal: 1,
      identityDrift: 0,
      contradictionFlux: LEGALITY_BOUNDS.fluxMax + 0.01,
      roleBalancePenalty: 0
    });
    expect(r.legal).toBe(false);
    expect(r.violations.some((v) => v.startsWith("contradiction_flux_exceeds"))).toBe(true);
  });

  it("weights legality heaviest", () => {
    const legalityHit = scoreObjective({ klFidelity: 0, functorLegal: 0, identityDrift: 0, contradictionFlux: 0, roleBalancePenalty: 0 }).J;
    const driftHit = scoreObjective({ klFidelity: 0, functorLegal: 1, identityDrift: 1, contradictionFlux: 0, roleBalancePenalty: 0 }).J;
    expect(legalityHit).toBeGreaterThan(driftHit);
  });
});

describe("monotonicity", () => {
  it("allows the first turn (no previous J)", () => {
    expect(isMonotonic(null, 5)).toBe(true);
  });
  it("allows a non-increasing J", () => {
    expect(isMonotonic(5, 4.9)).toBe(true);
    expect(isMonotonic(5, 5)).toBe(true);
  });
  it("flags an increasing J", () => {
    expect(isMonotonic(5, 6)).toBe(false);
  });
});

describe("R_AWG role-balance penalty", () => {
  it("is ~0 for confident, balanced routing", () => {
    const p = roleBalancePenalty({
      routingConfidences: [0.95, 0.92, 0.9],
      distribution: { arc: 2, wedge: 1, gap: 1, heldOut: 0 }
    });
    expect(p).toBeLessThan(0.15);
  });
  it("penalizes ARC-collapse (everything pinned to stable)", () => {
    const p = roleBalancePenalty({
      routingConfidences: [0.9, 0.9, 0.9],
      distribution: { arc: 10, wedge: 0, gap: 0, heldOut: 0 }
    });
    expect(p).toBeGreaterThanOrEqual(0.5);
  });
  it("penalizes low routing confidence", () => {
    const p = roleBalancePenalty({
      routingConfidences: [0.2, 0.3, 0.1],
      distribution: { arc: 1, wedge: 1, gap: 1, heldOut: 0 }
    });
    expect(p).toBeGreaterThan(0.5);
  });
});
