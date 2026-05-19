import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { SessionOpennessState } from "@luxcrypta/continuity-types/governance";
import { uniqueStrings } from "@luxcrypta/continuity-types/utils/text";
import { uniqueCandidateTexts } from "./partition";
import type { SessionCandidate } from "./types";

function modePreservesCreativeSpace(mode?: ModeName): boolean {
  return mode === "research" || mode === "creative" || mode === "debate";
}

export function updateOpennessLane(input: {
  previous?: SessionOpennessState;
  opennessCandidates: SessionCandidate[];
  preferredMode?: ModeName;
  preserveOpenQuestions: boolean;
  timestamp: string;
}): SessionOpennessState {
  const openQuestions = uniqueCandidateTexts(input.opennessCandidates, "open_question");
  const uncertaintyNotes = uniqueCandidateTexts(input.opennessCandidates, "uncertainty");
  const optionalBranches = uniqueCandidateTexts(input.opennessCandidates, "optional_branch");

  return {
    openQuestions: input.preserveOpenQuestions
      ? uniqueStrings([...(input.previous?.openQuestions ?? []), ...openQuestions]).slice(0, 10)
      : openQuestions.slice(0, 6),
    uncertaintyNotes: uniqueStrings([...(input.previous?.uncertaintyNotes ?? []), ...uncertaintyNotes]).slice(0, 10),
    optionalBranches: uniqueStrings([...(input.previous?.optionalBranches ?? []), ...optionalBranches]).slice(0, 8),
    preservedCreativeSpace:
      modePreservesCreativeSpace(input.preferredMode) ||
      optionalBranches.length > 0 ||
      Boolean(input.previous?.preservedCreativeSpace),
    lastUpdatedAt: input.timestamp
  };
}
