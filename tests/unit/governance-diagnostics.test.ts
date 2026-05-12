import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";

describe("governance diagnostics", () => {
  it("generates plain-language health summaries", () => {
    const request = {
      sourceText: "Objective: Compare options. Must cite sources. What remains unknown? Consider alternatives.",
      mode: "research" as const
    };
    const result = updateSessionGovernance({
      transformRequest: request,
      transformResult: transformPrompt(request)
    });

    expect(result.state.diagnostics.stableCoreSummary[0]).toContain("Objective");
    expect(result.state.diagnostics.opennessSummary.join(" ")).toMatch(/open|uncertainty|branch|Exploratory/i);
    expect(result.state.monitors.sessionHealth).toMatch(/healthy|watch|unstable/);
  });
});
