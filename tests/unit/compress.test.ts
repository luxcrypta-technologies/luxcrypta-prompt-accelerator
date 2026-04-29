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

  it("does not repeat requirements from an already-structured prompt", () => {
    const normalized = normalizePrompt(
      "Objective: I need a concise research prompt. Requirements: - Do not remove the requirement for citations. - Keep the output in bullet points only."
    );
    const constraints = extractConstraints(normalized);
    const compressed = compressPrompt(normalized, constraints, { sourceText: normalized });

    expect(compressed).toContain("Objective: I need a concise research prompt.");
    expect(compressed.match(/Do not remove the requirement for citations/g)).toHaveLength(1);
    expect(compressed.match(/Keep the output in bullet points only/g)).toHaveLength(1);
    expect(compressed).not.toContain("Objective: Objective:");
  });
});
