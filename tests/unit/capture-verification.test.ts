import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { buildDiagnosticState, type ReviewArtifactContext } from "@/review/continuity-artifacts";
import type { SessionGovernanceState } from "@/types/governance";

/**
 * Regression guard for the 2.3.5 fix.
 *
 * capture_verification previously emitted all-null because the review App
 * sourced its fields from a sessionState whose conversationKey/snapshot_scope
 * were never populated. This pins the contract: when those are present, the
 * diagnostic must surface them (so isolation is provable from the JSON, not
 * merely inferred from topic separation).
 */

const SCOPE = {
  turns_captured: 8,
  capture_scope: "full" as const,
  coverage_confidence: "high" as const,
  role_attribution: "dom_markers" as const
};

function sessionWith(conversationKey: string): SessionGovernanceState {
  return {
    id: "session_user_abc",
    conversationKey,
    title: "Tokyo trip",
    stableCore: {
      objective: "Plan a 5-day Tokyo trip reachable by train.",
      hardConstraints: ["Everything reachable by train."],
      acceptedDecisions: ["Decision: base in Shinjuku."],
      preferredMode: "precision",
      lastUpdatedAt: "2026-05-31T00:00:00.000Z"
    },
    noveltyLane: [],
    opennessLane: {
      openQuestions: ["Shinjuku or Shibuya base?"],
      uncertaintyNotes: [],
      optionalBranches: [],
      preservedCreativeSpace: false,
      lastUpdatedAt: "2026-05-31T00:00:00.000Z"
    },
    monitors: {
      continuityScore: 90,
      driftScore: 8,
      noveltyLoad: 10,
      opennessScore: 40,
      compressionDensity: 70,
      sessionHealth: "healthy"
    },
    diagnostics: {
      stableCoreSummary: [],
      noveltySummary: [],
      opennessSummary: [],
      warnings: [],
      actionsSuggested: [],
      generatedAt: "2026-05-31T00:00:00.000Z",
      snapshot_scope: SCOPE
    },
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z"
  } as SessionGovernanceState;
}

function cvOf(conversationKey: string, overrides: Partial<ReviewArtifactContext> = {}) {
  const result = transformPrompt({ sourceText: "Help me plan a 5-day Tokyo trip in October." });
  const diagnostic = buildDiagnosticState({
    result,
    transformedText: result.transformedText,
    sessionState: sessionWith(conversationKey),
    extensionVersion: "2.3.5",
    currentUrl: "chrome-extension://review.html",
    ...overrides
  }) as Record<string, unknown>;
  return diagnostic.capture_verification as {
    conversation_key: unknown;
    conversation_key_is_ephemeral: unknown;
    snapshot_scope: { capture_scope: string; role_attribution: string } | null;
  };
}

describe("capture_verification population (2.3.5)", () => {
  it("surfaces a real conversation key and full snapshot scope", () => {
    const cv = cvOf("claude:real-uuid-1", {
      conversationKey: "claude:real-uuid-1",
      conversationId: "real-uuid-1",
      snapshotScope: SCOPE
    });
    expect(cv.conversation_key).toBe("claude:real-uuid-1");
    expect(cv.conversation_key_is_ephemeral).toBe(false);
    expect(cv.snapshot_scope?.capture_scope).toBe("full");
    expect(cv.snapshot_scope?.role_attribution).toBe("dom_markers");
  });

  it("flags an ephemeral (/new-window) key as ephemeral", () => {
    const cv = cvOf("claude:tab-abc123");
    expect(cv.conversation_key_is_ephemeral).toBe(true);
  });

  it("falls back to session state when context override fields are absent", () => {
    const cv = cvOf("claude:real-uuid-2");
    expect(cv.conversation_key).toBe("claude:real-uuid-2");
    expect(cv.snapshot_scope?.capture_scope).toBe("full");
  });
});
