import { describe, expect, it } from "vitest";
import { compressPrompt } from "@/core/compress";
import { extractConstraints } from "@/core/constraints";
import { normalizePrompt } from "@/core/normalize";

describe("compressPrompt", () => {
  it("keeps hard constraints while removing filler", () => {
    const normalized = normalizePrompt("Please basically write a plan.\nMust use TypeScript.\nPlease basically write a plan.");
    const constraints = extractConstraints(normalized);
    const compressed = compressPrompt(normalized, constraints, { sourceText: normalized });
    expect(compressed).toContain("Objective:");
    expect(compressed).toContain("Must use TypeScript.");
    expect(compressed.match(/write a plan/g)).toHaveLength(1);
  });
});
