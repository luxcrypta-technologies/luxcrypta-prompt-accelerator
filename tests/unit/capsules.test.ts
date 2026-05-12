import { describe, expect, it } from "vitest";
import { createCapsuleFromSnapshot } from "@luxcrypta/continuity-core/capsules";

describe("createCapsuleFromSnapshot", () => {
  it("creates compact carry-forward capsules from shallow snapshots", () => {
    const capsule = createCapsuleFromSnapshot({
      title: "Build flow",
      turns: [
        { role: "user", text: "We must use TypeScript. Should we keep the popup small?" },
        { role: "assistant", text: "Decision: use a compact popup and review page." }
      ]
    });
    expect(capsule.capsule_version).toBe(1);
    expect(capsule.constraints).toContain("We must use TypeScript.");
    expect(capsule.decisions[0]).toContain("Decision");
    expect(capsule.open_questions[0]).toContain("Should we keep");
  });
});
