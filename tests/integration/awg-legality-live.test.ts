import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";

describe("ARC/WEDGE/GAP + legality wired into live session update (Stage 1)", () => {
  it("surfaces an AWG distribution and a legality verdict per turn", () => {
    const r1 = { sourceText: "Help me plan a 5-day Tokyo trip. Must be reachable by train.", mode: "research" as const };
    const s1 = updateSessionGovernance({ transformRequest: r1, transformResult: transformPrompt(r1) });
    const d1 = s1.state.diagnostics;
    expect(d1.awg_distribution).toBeDefined();
    expect(d1.awg_distribution!.arc).toBeGreaterThan(0); // objective + constraints land in ARC
    expect(d1.legality).toBeDefined();
    expect(d1.legality!.legal).toBe(true);
    expect(d1.legality!.monotonic).toBe(true); // first turn is always monotonic
  });

  it("flags a turn that adds state as non-monotonic and surfaces a WEDGE", () => {
    const r1 = { sourceText: "Help me plan a 5-day Tokyo trip. Must be reachable by train.", mode: "research" as const };
    const s1 = updateSessionGovernance({ transformRequest: r1, transformResult: transformPrompt(r1) });
    const r2 = { sourceText: "Decision: base in Shinjuku. Add a day trip to Nikko by train.", mode: "research" as const };
    const s2 = updateSessionGovernance({ previousState: s1.state, transformRequest: r2, transformResult: transformPrompt(r2) });
    expect(s2.state.diagnostics.awg_distribution!.wedge).toBeGreaterThan(0);
    expect(s2.state.diagnostics.legality!.legal).toBe(true);
  });

  it("keeps legality true for ordinary user-directed changes (no false drift violation)", () => {
    const r1 = { sourceText: "Objective: Write a research brief. Must cite sources.", mode: "research" as const };
    const s1 = updateSessionGovernance({ transformRequest: r1, transformResult: transformPrompt(r1) });
    const r2 = { sourceText: "Objective: Write a research brief comparing two tools. Must cite sources. Add a risk table.", mode: "research" as const };
    const s2 = updateSessionGovernance({ previousState: s1.state, transformRequest: r2, transformResult: transformPrompt(r2) });
    expect(s2.state.diagnostics.legality!.legal).toBe(true);
    expect(s2.state.diagnostics.legality!.violations).toEqual([]);
  });
});
