import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";
import { buildDiagnosticState } from "@/review/continuity-artifacts";

describe("D9/D10 + governance_routing surfacing (Stage 1)", () => {
  it("records cap overflow instead of silently dropping (D10)", () => {
    // Build a session that accumulates many distinct constraints over turns.
    let prev: ReturnType<typeof updateSessionGovernance>["state"] | undefined;
    for (let t = 0; t < 20; t++) {
      const req = { sourceText: `Objective: build a spec. Must satisfy unique-rule-number-${t} exactly.`, sourceSurface: "chatgpt" as const };
      const res = updateSessionGovernance({ previousState: prev, transformRequest: req, transformResult: transformPrompt(req) });
      prev = res.state;
    }
    expect(prev!.diagnostics.cap_overflow).toBeDefined();
    expect(typeof prev!.diagnostics.cap_overflow!.total).toBe("number");
    // placement check present and clean for normal stable items (D9)
    expect(prev!.diagnostics.placement_mismatches).toBe(0);
  });

  it("surfaces governance_routing in the review diagnostic JSON", () => {
    const req = { sourceText: "Help me plan a 5-day Tokyo trip. Must be reachable by train.", mode: "research" as const };
    const res = transformPrompt(req);
    const session = updateSessionGovernance({ transformRequest: req, transformResult: res });
    const diag = buildDiagnosticState({
      result: res,
      transformedText: res.transformedText,
      sessionState: session.state,
      extensionVersion: "2.4.0",
      currentUrl: "chrome-extension://review.html"
    }) as Record<string, { awg_distribution: unknown; legality: unknown }>;
    const gr = diag.governance_routing as { awg_distribution: unknown; legality: unknown };
    expect(gr).toBeDefined();
    expect(gr.awg_distribution).toBeDefined();
    expect(gr.legality).toBeDefined();
  });
});
