import type { SessionGovernanceState, SessionNoveltyItem, SessionStableCore } from "@/types/governance";
import { createDatedId } from "@/utils/ids";
import { uniqueStrings } from "@/utils/text";
import { isMeaningfullySimilar } from "./stable-core";
import type { SessionCandidate } from "./types";

function isExistingNovelty(candidate: SessionCandidate, existing: SessionNoveltyItem[]): boolean {
  const kind = noveltyKindForCandidate(candidate.kind);
  return existing.some(
    (item) =>
      item.kind === kind &&
      (item.text.toLowerCase() === candidate.text.toLowerCase() || isMeaningfullySimilar(item.text, candidate.text))
  );
}

function noveltyKindForCandidate(candidateKind: SessionCandidate["kind"]): SessionNoveltyItem["kind"] | null {
  if (candidateKind === "objective") return "new_objective";
  if (candidateKind === "constraint") return "new_constraint";
  if (candidateKind === "decision") return "new_decision";
  if (candidateKind === "output_contract") return "output_shift";
  return null;
}

function isRefinementInstruction(text: string): boolean {
  return /\b(make it|optimize it|preserve the same|keep citations|keep.*bullet points|same research goal|same objective)\b/i.test(
    text
  );
}

function splitClaims(text: string): string[] {
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((claim) => claim.replace(/^- /, "").trim())
    .filter((claim) => claim.length > 3);
}

function stableClaims(stableCore: SessionStableCore): string[] {
  return [
    stableCore.objective,
    ...stableCore.hardConstraints,
    ...stableCore.acceptedDecisions,
    stableCore.outputContract ?? ""
  ].filter(Boolean);
}

function isCoveredByStableCore(text: string, stableCore: SessionStableCore): boolean {
  const claims = splitClaims(text);
  const stable = stableClaims(stableCore);
  if (!claims.length || !stable.length) return false;

  return claims.every((claim) => stable.some((stableClaim) => isMeaningfullySimilar(claim, stableClaim)));
}

function requirementLikeObjective(text: string): SessionNoveltyItem["kind"] | null {
  if (/\b(executive summary|summary at the top|output|format|table|json|yaml|markdown)\b/i.test(text)) {
    return "output_shift";
  }
  if (/\b(also include|include|add|compare|cover|address)\b/i.test(text)) {
    return "new_constraint";
  }
  return null;
}

function noveltyKind(candidate: SessionCandidate, stableCore: SessionStableCore): SessionNoveltyItem["kind"] | null {
  if (isCoveredByStableCore(candidate.text, stableCore)) return null;

  if (candidate.kind === "objective") {
    if (isRefinementInstruction(candidate.text)) return null;
    const requirementKind = requirementLikeObjective(candidate.text);
    if (requirementKind) return requirementKind;
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
    if (candidate.source === "transform") return null;
    if (isRefinementInstruction(candidate.text)) return null;
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
