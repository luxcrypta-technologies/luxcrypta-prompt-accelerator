import { describe, expect, it } from "vitest";
import { adaptForModel } from "@luxcrypta/continuity-core/model-adapters";

describe("adaptForModel", () => {
  it("shapes Claude prompts without changing the task", () => {
    const result = adaptForModel("Objective: write a summary", "claude", "focus");
    expect(result).toContain("Please handle this carefully");
    expect(result).toContain("Objective: write a summary");
  });

  it("shapes Grok prompts without changing the task", () => {
    const result = adaptForModel("Objective: preserve continuity", "grok", "focus");
    expect(result).toContain("Keep the tone concise");
    expect(result).toContain("Objective: preserve continuity");
  });

  it("shapes DeepSeek and Perplexity prompts around their continuity risks", () => {
    const deepseek = adaptForModel("Objective: preserve unresolved state", "deepseek", "focus");
    const perplexity = adaptForModel("Objective: preserve stable state", "perplexity", "research");

    expect(deepseek).toContain("preserve unresolved tensions");
    expect(perplexity).toContain("retrieved or cited material as Provisional or Quarantine");
  });
});
