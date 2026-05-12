import { describe, expect, it } from "vitest";
import { buildDiff } from "@luxcrypta/continuity-core/diff";

describe("buildDiff", () => {
  it("returns inspectable replace blocks", () => {
    const diff = buildDiff("hello", "hello world");
    expect(diff[0].operation).toBe("replace");
    expect(diff[0].reason).toBeTruthy();
  });
});
