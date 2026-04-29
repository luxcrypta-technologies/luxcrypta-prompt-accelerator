import type { SessionGovernanceState, SessionNoveltyItem, SessionStableCore } from "@/types/governance";
import { createDatedId } from "@/utils/ids";
import { uniqueStrings } from "@/utils/text";
import { isMeaningfullySimilar } from "./stable-core";
import type { SessionCandidate } from "./types";

function isExistingNovelty(candidate: SessionCandidate, existing: SessionNoveltyItem[]): boolean {
  return existing.some((item) => item.text.toLowerCase() === candidate.text.toLowerCase());
}

function noveltyKind(candidate: SessionCandidate, stableCore: SessionStableCore): SessionNoveltyItem["kind"] | null {
  if (candidate.kind === "objective") {
    return isMeaningfullySimilar(candidate.text, stableCore.objective) ? null : "new_objective";
  }
  if (candidate.kind === "constraint") {
    const existing = stableCore.hardConstraints.some((constraint) => isMeaningfullySimilar(constraint, candidate.text));
    if (existing) return null;
    if (/\b(instead|replace|rather than|no longer|change|stop using)\b/i.test(candidate.text)) return "changed_constraint";
    return "new_constraint";
  }
  if (candidate.kind === "decision") {
    const existing = stableCore.acceptedDecisions.some((decision) => isMeaningfullySimilar(decision, candidate.text));
    return existing ? null : "new_decision";
  }
  if (candidate.kind === "output_contract") {
    return stableCore.outputContract && isMeaningfullySimilar(stableCore.outputContract, candidate.text) ? null : "output_shift";
  }
  return null;
}

export function updateNoveltyLane(input: {
  previous: SessionNoveltyItem[];
  candidates: SessionCandidate[];
  stableCore: SessionStableCore;
  timestamp: string;
}): SessionNoveltyItem[] {
  const newItems = input.candidates
    .map((candidate): SessionNoveltyItem | null => {
      const kind = noveltyKind(candidate, input.stableCore);
      if (!kind || isExistingNovelty(candidate, input.previous)) return null;
      return {
        id: createDatedId("novelty", `${kind}:${candidate.text}`, input.timestamp),
        text: candidate.text,
        kind,
        confidence: candidate.confidence,
        source: candidate.source,
        createdAt: input.timestamp,
        accepted: false
      };
    })
    .filter((item): item is SessionNoveltyItem => Boolean(item));

  return [...input.previous.filter((item) => !item.accepted), ...newItems].slice(-16);
}

export function promoteNoveltyItems(
  state: SessionGovernanceState,
  noveltyIds: string[],
  timestamp: string
): SessionGovernanceState {
  const ids = new Set(noveltyIds);
  const promoted = state.noveltyLane.filter((item) => ids.has(item.id));
  const remaining = state.noveltyLane.filter((item) => !ids.has(item.id));
  const constraints = promoted
    .filter((item) => item.kind === "new_constraint" || item.kind === "changed_constraint")
    .map((item) => item.text);
  const decisions = promoted.filter((item) => item.kind === "new_decision").map((item) => item.text);
  const objective = promoted.find((item) => item.kind === "new_objective" || item.kind === "framing_shift")?.text;
  const outputContract = promoted.find((item) => item.kind === "output_shift")?.text;

  return {
    ...state,
    stableCore: {
      ...state.stableCore,
      objective: objective ?? state.stableCore.objective,
      hardConstraints: uniqueStrings([...state.stableCore.hardConstraints, ...constraints]).slice(0, 12),
      acceptedDecisions: uniqueStrings([...state.stableCore.acceptedDecisions, ...decisions]).slice(0, 12),
      outputContract: outputContract ?? state.stableCore.outputContract,
      lastUpdatedAt: timestamp
    },
    noveltyLane: remaining,
    updatedAt: timestamp
  };
}
