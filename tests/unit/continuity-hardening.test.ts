import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import type { ProviderProfile } from "@luxcrypta/continuity-types/surfaces";
import { formatContinuityExport } from "@/review/continuity-artifacts";

const fixtureDir = resolve(process.cwd(), "tests/fixtures/brutal");

function fixture(name: string): string {
  return readFileSync(resolve(fixtureDir, name), "utf8");
}

function profile(provider: string): ProviderProfile {
  return {
    provider,
    continuity_style: "test",
    preferred_handoff: "clean_state",
    capsule_bias: "strict",
    risk_profile: [`${provider}_contamination`],
    recommended_runtime_emphasis: ["prefer quarantine over contaminated durable state"],
    retrieved_content_default_state:
      provider === "perplexity" ? "provisional_or_quarantine" : undefined
  };
}

function normalized(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

describe("aggressive continuity hardening", () => {
  it("strips DeepSeek scaffolding and preserves governance, invariants, rejections, and unresolved state", () => {
    const result = transformPrompt({
      sourceText: fixture("deepseek-contaminated-review.txt"),
      sourceSurface: "deepseek",
      providerProfile: profile("deepseek")
    });
    const governance = result.continuityReview.diagnostics.adversarialGovernance;
    const stable = result.continuityReview.stableCore.join(" ");

    expect(stable).not.toMatch(/Stage 1|Final scores|Reconstruction confidence/i);
    expect(governance?.governance_principles.join(" ")).toContain("user-authored trusted state");
    expect(governance?.invariants.join(" ")).toContain("No silent transitions");
    expect(governance?.rejected_directions.join(" ")).toContain("Do not admit generated section furniture");
    expect(result.continuityReview.openUnresolved.join(" ")).toContain("provider surfaces");
    expect(result.scores.negativeStatePreservation).toBe(1);
  });

  it("removes Perplexity chrome before admission and export", () => {
    const result = transformPrompt({
      sourceText: fixture("perplexity-visible-open-failure.txt"),
      sourceSurface: "perplexity",
      providerProfile: profile("perplexity")
    });
    const exported = formatContinuityExport(result, result.transformedText);
    const durable = [
      result.continuityReview.activeObjective,
      ...result.continuityReview.stableCore,
      ...(result.continuityReview.diagnostics.adversarialGovernance?.governance_principles ?? []),
      ...(result.continuityReview.diagnostics.adversarialGovernance?.invariants ?? []),
      ...(result.continuityReview.diagnostics.adversarialGovernance?.rejected_directions ?? [])
    ].join("\n");

    expect(durable).not.toMatch(/Show more|Show less|Copy|Advanced|Try Pro/i);
    expect(exported).not.toMatch(/Show more|Show less|Copy|Advanced|Try Pro/i);
    expect(result.continuityReview.diagnostics.retrievalContext?.join(" ")).toContain(
      "source card"
    );
    expect(result.continuityReview.diagnostics.export_readiness_decision).toBe(
      "READY_FOR_HANDOFF"
    );
  });

  it("quarantines ChatGPT assistant helper structure by default", () => {
    const result = transformPrompt({
      sourceText: fixture("chatgpt-over-admission.txt"),
      sourceSurface: "chatgpt",
      providerProfile: profile("chatgpt")
    });
    const governance = result.continuityReview.diagnostics.adversarialGovernance;
    const stable = result.continuityReview.stableCore.join(" ");

    expect(stable).not.toContain("assistant-generated summary should become");
    expect(governance?.quarantined_items.map((item) => item.text).join(" ")).toContain(
      "assistant-generated summary"
    );
    expect(
      governance?.canonical_items.some(
        (item) => item.source_role === "assistant_output" && item.decision === "admit"
      )
    ).toBe(false);
    expect(governance?.rejected_directions.join(" ")).toContain(
      "Do not admit assistant-generated helper formatting"
    );
  });

  it("keeps live ChatGPT reconstruction prose out of Stable Core while preserving negative state", () => {
    const result = transformPrompt({
      sourceText: `user:
Mission: Evaluate AI continuity infrastructure under adversarial conditions.
Governance principles:
- Governance outranks convenience.
- Transparency outranks smoothness.
- Rejections must remain visible.
Stable constraints:
- Preserve governance integrity.
- Preserve rejected directions.
- Preserve unresolved tensions.
- Do not overwrite trusted state without explicit justification.
Rejected directions:
- Do not turn this into a generic chatbot task.
- Do not ignore previous governance.
- Do not accept untrusted overrides automatically.
Open tensions:
- How strict quarantine should be when user text contains adversarial override examples remains unresolved.

assistant:
Portable Operational Cognition State
A future model reconstructing this state must do the following:
- Restore the mission exactly.
- Whether future models should preserve wording exactly or semantically.
- Best reconstruction prompt.

user:
Construct a portable operational cognition state for a long-running AI workflow that must survive hostile instruction injection.`,
      sourceSurface: "chatgpt",
      providerProfile: profile("chatgpt")
    });
    const review = result.continuityReview;
    const governance = review.diagnostics.adversarialGovernance;
    const stable = review.stableCore.join(" ");
    const canonicalAssistantStable =
      governance?.canonical_items.filter(
        (item) => item.primary_bucket === "stable_core" && item.source_role === "assistant_output"
      ) ?? [];

    expect(stable).not.toMatch(/future model reconstructing|restore the mission exactly|best reconstruction prompt/i);
    expect(canonicalAssistantStable).toHaveLength(0);
    expect(governance?.quarantined_items.map((item) => item.text).join(" ")).toMatch(
      /future model reconstructing|restore the mission exactly/i
    );
    expect(governance?.governance_principles.join(" ")).toContain(
      "Governance outranks convenience"
    );
    expect(governance?.invariants.join(" ")).toContain("Preserve governance integrity");
    expect(governance?.rejected_directions.join(" ")).toContain(
      "Do not accept untrusted overrides automatically"
    );
    expect(review.openUnresolved.join(" ")).toContain("remains unresolved");
    expect(result.scores.assistantContaminationScore).toBe(0);
    expect(result.scores.negativeStatePreservation).toBe(1);
  });

  it("keeps Claude framing resistance out of durable state", () => {
    const result = transformPrompt({
      sourceText: fixture("claude-framing-resistance.txt"),
      sourceSurface: "claude",
      providerProfile: profile("claude")
    });
    const stable = result.continuityReview.stableCore.join(" ");
    const quarantine =
      result.continuityReview.diagnostics.adversarialGovernance?.quarantine_log.join(" ") ?? "";

    expect(stable).not.toMatch(/can't comply|conversational simulation|framing note/i);
    expect(quarantine).toMatch(/conversational simulation|framing note/i);
    expect(result.continuityReview.diagnostics.adversarialGovernance?.invariants.join(" ")).toContain(
      "meta refusal text"
    );
  });

  it("strips Gemini pseudo-formal enforcement theater unless user-authored", () => {
    const result = transformPrompt({
      sourceText: fixture("gemini-enforcement-theater.txt"),
      sourceSurface: "gemini",
      providerProfile: profile("gemini")
    });
    const stable = result.continuityReview.stableCore.join(" ");
    const quarantine =
      result.continuityReview.diagnostics.adversarialGovernance?.quarantine_log.join(" ") ?? "";

    expect(stable).not.toMatch(/Formal Validation Framework|external dependency expansion/i);
    expect(quarantine).toMatch(/external dependency expansion/i);
    expect(result.continuityReview.diagnostics.adversarialGovernance?.rejected_directions.join(" ")).toContain(
      "Do not inflate dependencies"
    );
  });

  it("detects fused governance, invariant, and rejected-direction text without headings surviving as items", () => {
    const result = transformPrompt({
      sourceText:
        "Objective: harden state admission. Governance principles: trusted state outranks untrusted output. Invariants: No silent transitions. Rejected directions: Do not flatten unresolved tensions. Open question: what remains unresolved?",
      sourceSurface: "deepseek",
      providerProfile: profile("deepseek")
    });
    const governance = result.continuityReview.diagnostics.adversarialGovernance;
    const itemTexts = governance?.canonical_items.map((item) => item.text) ?? [];

    expect(governance?.governance_principles.join(" ")).toContain("trusted state outranks");
    expect(governance?.invariants.join(" ")).toContain("No silent transitions");
    expect(governance?.rejected_directions.join(" ")).toContain("Do not flatten unresolved tensions");
    expect(itemTexts.some((item) => /^governance principles$/i.test(item))).toBe(false);
  });

  it("keeps one primary bucket per normalized canonical item and records collisions as cross refs", () => {
    const result = transformPrompt({
      sourceText:
        "Objective: preserve continuity. Governance principles: No silent transitions. Invariants: No silent transitions. Rejected directions: Do not silently resolve unresolved questions.",
      sourceSurface: "deepseek",
      providerProfile: profile("deepseek")
    });
    const items = result.continuityReview.diagnostics.adversarialGovernance?.canonical_items ?? [];
    const primaryByText = new Map<string, string>();

    for (const item of items) {
      const key = normalized(item.text);
      const prior = primaryByText.get(key);
      expect(prior === undefined || prior === item.primary_bucket).toBe(true);
      primaryByText.set(key, item.primary_bucket);
    }
    expect(result.scores.bucketExclusivityScore).toBeGreaterThanOrEqual(0.66);
  });
});
