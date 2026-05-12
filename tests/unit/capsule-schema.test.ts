import { describe, expect, it } from "vitest";
import { isCarryForwardCapsule } from "@luxcrypta/continuity-types/guards";
import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";

describe("capsule schema", () => {
  it("accepts versioned portable capsules and rejects unversioned data", () => {
    const capsule: CarryForwardCapsule = {
      capsule_version: 1,
      id: "capsule_1",
      title: "Desktop MVP",
      objective: "Preserve AI workflow continuity",
      constraints: ["Stay local-first"],
      decisions: ["Use Electron for MVP"],
      open_questions: ["When should sync arrive?"],
      preferred_mode: "focus",
      notes: "Portable between providers",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z"
    };

    expect(isCarryForwardCapsule(capsule)).toBe(true);
    expect(isCarryForwardCapsule({ ...capsule, capsule_version: 2 })).toBe(false);
    expect(isCarryForwardCapsule({ ...capsule, constraints: "Stay local-first" })).toBe(false);
  });
});
