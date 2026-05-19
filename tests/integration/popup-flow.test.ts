import { describe, expect, it } from "vitest";
import { ADVANCED_ACTION, PRIMARY_ACTIONS, RUNTIME_LABEL, SECONDARY_ACTIONS, SUPPORTED_SURFACES } from "@/app/constants";

describe("popup flow configuration", () => {
  it("keeps the default popup in the quiet continuity runtime model", () => {
    const primaryLabels = PRIMARY_ACTIONS.map((action) => action.label as string);
    expect(RUNTIME_LABEL).toBe("Powered by LuxCrypta");
    expect(ADVANCED_ACTION.label).toBe("Advanced");
    expect(primaryLabels).toEqual(["Advanced"]);
    expect(SECONDARY_ACTIONS).toEqual([]);
    expect(primaryLabels.includes("Compress")).toBe(false);
    expect(primaryLabels.includes("Focus")).toBe(false);
    expect(SUPPORTED_SURFACES.some((surface) => surface.id === "grok" && surface.hosts.includes("grok.com"))).toBe(
      true
    );
  });
});
