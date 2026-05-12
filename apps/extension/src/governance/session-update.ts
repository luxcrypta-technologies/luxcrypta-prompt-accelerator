import { createCarryForwardFromGovernance } from "./carry-forward";
import { generateSessionDiagnostics } from "./diagnostics";
import { computeSessionMonitors } from "./monitors";
import { updateNoveltyLane } from "./novelty";
import { updateOpennessLane } from "./openness";
import { extractSessionCandidates, partitionSessionCandidates } from "./partition";
import { updateStableCore } from "./stable-core";
import type { SessionGovernanceState, SessionUpdateInput, SessionUpdateResult } from "@/types/governance";
import { firstMeaningfulLine } from "@/utils/text";
import { nowIso } from "@/utils/time";

function originalLength(input: SessionUpdateInput): number {
  return (
    input.transformRequest?.sourceText.length ??
    input.transformResult?.originalText.length ??
    input.capsule?.objective.length ??
    input.conversationSnapshot?.turns.map((turn) => turn.text).join("\n").length ??
    0
  );
}

function fallbackText(input: SessionUpdateInput): string {
  return (
    input.transformRequest?.sourceText ??
    input.transformResult?.transformedText ??
    input.capsule?.objective ??
    input.conversationSnapshot?.turns.map((turn) => turn.text).join("\n") ??
    ""
  );
}

function titleFor(input: SessionUpdateInput, state: SessionGovernanceState | null | undefined, text: string): string | undefined {
  return state?.title ?? input.conversationSnapshot?.title ?? firstMeaningfulLine(text, "").slice(0, 80) ?? undefined;
}

export function updateSessionGovernance(input: SessionUpdateInput): SessionUpdateResult {
  const timestamp = nowIso();
  const previous = input.previousState ?? null;
  const candidates = extractSessionCandidates(input);
  const partition = partitionSessionCandidates(candidates);
  const text = fallbackText(input);
  const preferredMode = input.transformRequest?.mode ?? input.transformResult?.modeApplied ?? input.capsule?.preferred_mode;
  const preferredTargetModel = input.transformRequest?.targetModel ?? input.transformResult?.targetModelApplied;
  const stableCore = updateStableCore({
    previous: previous?.stableCore,
    stableCandidates: partition.stableCandidates,
    fallbackText: text,
    preferredMode,
    preferredTargetModel,
    conservativeUpdates: input.conservativeStableCoreUpdates,
    timestamp
  });
  const opennessLane = updateOpennessLane({
    previous: previous?.opennessLane,
    opennessCandidates: partition.opennessCandidates,
    preferredMode,
    preserveOpenQuestions: input.preserveOpenQuestions ?? true,
    timestamp
  });
  const noveltyLane = updateNoveltyLane({
    previous: previous?.noveltyLane ?? [],
    candidates: partition.noveltyCandidates,
    stableCore,
    timestamp
  });
  const monitors = computeSessionMonitors({
    previousState: previous,
    stableCore,
    noveltyLane,
    opennessLane,
    originalLength: originalLength(input)
  });
  const baseState: Omit<SessionGovernanceState, "diagnostics"> = {
    id: previous?.id ?? `session_${stableCore.objective.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 36) || "active"}`,
    title: titleFor(input, previous, text),
    stableCore,
    noveltyLane,
    opennessLane,
    monitors,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp
  };
  const state: SessionGovernanceState = {
    ...baseState,
    diagnostics: generateSessionDiagnostics(baseState, timestamp)
  };

  return {
    state,
    carryForwardCandidate: createCarryForwardFromGovernance(state)
  };
}
