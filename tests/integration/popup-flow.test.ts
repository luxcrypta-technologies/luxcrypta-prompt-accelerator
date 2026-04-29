import { describe, expect, it } from "vitest";
import { PRIMARY_ACTIONS, SECONDARY_ACTIONS } from "@/app/constants";

describe("popup flow configuration", () => {
  it("keeps primary one-click actions immediately available", () => {
    expect(PRIMARY_ACTIONS.map((action) => action.label)).toEqual([
      "Compress",
      "Focus",
      "Continue Session",
      "Save Workflow"
    ]);
    expect(SECONDARY_ACTIONS.some((action) => action.label === "Adapt for Claude")).toBe(true);
  });
});
