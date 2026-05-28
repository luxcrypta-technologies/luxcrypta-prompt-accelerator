import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";
import {
  buildCapsuleDraft,
  buildPortableCapsuleArtifact
} from "@/review/continuity-artifacts";

describe("session-level capsule export integration", () => {
  it("preserves earlier durable workflow state after a shallow final turn", () => {
    const firstRequest = {
      sourceText: [
        "Objective: Build true session-level durable-state-first capsule assembly.",
        "Stable constraints:",
        "- Prefer accumulated session durable state over latest-turn extraction.",
        "Governance principles:",
        "- Session state outranks prompt-local task shell text.",
        "Invariants:",
        "- No last-turn-only capsule collapse.",
        "Accepted decisions:",
        "- Decision: keep export format compact and reconstructable.",
        "Rejected directions:",
        "- Do not export only the last user turn.",
        "Open / Unresolved:",
        "- Open question: Was live persistence tested?",
        "Continuity safeguards:",
        "- Carry rejected directions and unresolved issues forward."
      ].join("\n"),
      sourceSurface: "chatgpt"
    };
    const firstResult = transformPrompt(firstRequest);
    const firstSession = updateSessionGovernance({
      transformRequest: firstRequest,
      transformResult: firstResult
    });
    const secondRequest = {
      sourceText:
        "Objective: final export. At the end provide What Changed, Files Changed, Validation, and Live Status.",
      sourceSurface: "chatgpt"
    };
    const secondResult = transformPrompt(secondRequest);
    const secondSession = updateSessionGovernance({
      previousState: firstSession.state,
      transformRequest: secondRequest,
      transformResult: secondResult
    });
    const capsule = {
      capsule_version: 1 as const,
      ...buildCapsuleDraft(secondResult, secondResult.transformedText, secondSession.state),
      id: "capsule_session_export",
      capsule_id: "capsule_session_export",
      created_at: "2026-05-22T00:00:00.000Z",
      updated_at: "2026-05-22T00:00:00.000Z"
    };

    const portableCapsule = buildPortableCapsuleArtifact(capsule, {
      result: secondResult,
      transformedText: secondResult.transformedText,
      sessionState: secondSession.state,
      extensionVersion: "2.3.1",
      currentUrl: "chrome-extension://review.html",
      capsule
    });
    const portableJson = JSON.stringify(portableCapsule);

    expect(portableCapsule.active_objective).toContain("session-level durable-state-first");
    expect(portableCapsule.governance_principles).toEqual(
      expect.arrayContaining([expect.stringContaining("Session state outranks")])
    );
    expect(portableCapsule.invariants).toEqual(
      expect.arrayContaining([expect.stringContaining("No last-turn-only")])
    );
    expect(portableCapsule.rejected_directions).toEqual(
      expect.arrayContaining([expect.stringContaining("last user turn")])
    );
    expect(portableCapsule.unresolved_issues).toEqual(
      expect.arrayContaining([expect.stringContaining("live persistence")])
    );
    expect(portableCapsule.continuity_safeguards).toEqual(
      expect.arrayContaining([expect.stringContaining("Carry rejected directions")])
    );
    expect(portableCapsule.export_source_mode).toMatch(/^session_durable_state/);
    expect(portableCapsule.fallback_to_latest_turn_only).toBe(false);
    expect(portableCapsule.session_level_capsule_passed).toBe(true);
    expect(portableJson).not.toMatch(/At the end provide|Files Changed|Live Status/i);
  });

  it("lets a genuinely clean structured handoff reach SAFE_FOR_HANDOFF", () => {
    const result = transformPrompt({
      sourceText: [
        "Objective: Preserve a clean durable handoff state.",
        "Stable constraints:",
        "- Keep durable buckets exclusive.",
        "Governance principles:",
        "- Truthfulness outranks convenience.",
        "Invariants:",
        "- No silent transitions.",
        "Rejected directions:",
        "- Do not flatten rejected directions into governance.",
        "Open / Unresolved:",
        "- Whether live validation is complete remains unresolved.",
        "Continuity safeguards:",
        "- Preserve rejected directions and unresolved issues."
      ].join("\n"),
      sourceSurface: "chatgpt"
    });
    const governance = result.continuityReview.diagnostics.adversarialGovernance;

    expect(result.continuityReview.diagnostics.export_readiness_decision).toBe(
      "SAFE_FOR_HANDOFF"
    );
    expect(result.continuityReview.diagnostics.readiness_blockers ?? []).not.toContain(
      "bucket exclusivity is below the handoff threshold"
    );
    expect(result.scores.bucketExclusivityScore).toBeGreaterThanOrEqual(0.85);
    expect(governance?.cross_ref_count).toBe(0);
    expect(governance?.exclusive_bucket_violation_count).toBe(0);
  });
});
