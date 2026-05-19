import type { SessionGovernanceState, SessionNoveltyItem, SessionStableCore } from "@luxcrypta/continuity-types/governance";
import { createDatedId } from "@luxcrypta/continuity-types/utils/ids";
import { uniqueMeaningfulStrings } from "@luxcrypta/continuity-types/utils/text";
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

function matchingNoveltyIndex(candidate: SessionCandidate, existing: SessionNoveltyItem[]): number {
  const kind = noveltyKindForCandidate(candidate.kind);
  return existing.findIndex(
    (item) =>
      !item.accepted &&
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

function isConflictLike(text: string, kind: SessionNoveltyItem["kind"]): boolean {
  return (
    kind === "changed_constraint" ||
    /\b(instead|replace|rather than|no longer|conflict|contradict|stop using|drop|remove)\b/i.test(text)
  );
}

function noveltyNote(item: Pick<SessionNoveltyItem, "text" | "kind" | "confidence" | "seenCount">): string | undefined {
  if (isConflictLike(item.text, item.kind)) return "Review manually; this may change accepted session state.";
  if ((item.seenCount ?? 1) >= 2 && item.confidence >= 0.72) return "Recurring and likely safe to promote after review.";
  return undefined;
}

function shouldBePromotable(item: Pick<SessionNoveltyItem, "text" | "kind" | "confidence" | "seenCount">): boolean {
  return !isConflictLike(item.text, item.kind) && (item.seenCount ?? 1) >= 2 && item.confidence >= 0.72;
}

function ageInDays(item: SessionNoveltyItem, timestamp: string): number {
  const lastSeen = Date.parse(item.lastSeenAt ?? item.createdAt);
  const now = Date.parse(timestamp);
  if (!Number.isFinite(lastSeen) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.floor((now - lastSeen) / 86_400_000));
}

function isStale(item: SessionNoveltyItem, timestamp: string): boolean {
  return !item.promotable && (item.seenCount ?? 1) <= 1 && ageInDays(item, timestamp) >= 30;
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
  const previous = input.previous.filter((item) => !item.accepted && !isStale(item, input.timestamp));
  const merged = [...previous];
  const newItems = input.candidates
    .map((candidate): SessionNoveltyItem | null => {
      const kind = noveltyKind(candidate, input.stableCore);
      if (!kind) return null;
      const existingIndex = matchingNoveltyIndex(candidate, merged);
      if (existingIndex >= 0) {
        const existing = merged[existingIndex];
        const seenCount = (existing.seenCount ?? 1) + 1;
        const updated = {
          ...existing,
          confidence: Math.max(existing.confidence, candidate.confidence),
          lastSeenAt: input.timestamp,
          seenCount,
          promotable: shouldBePromotable({ ...existing, confidence: Math.max(existing.confidence, candidate.confidence), seenCount }),
          diagnosticNote: noveltyNote({ ...existing, confidence: Math.max(existing.confidence, candidate.confidence), seenCount })
        };
        merged[existingIndex] = updated;
        return null;
      }
      if (isExistingNovelty(candidate, merged)) return null;
      const item = {
        id: createDatedId("novelty", `${kind}:${candidate.text}`, input.timestamp),
        text: candidate.text,
        kind,
        confidence: candidate.confidence,
        source: candidate.source,
        createdAt: input.timestamp,
        lastSeenAt: input.timestamp,
        seenCount: 1,
        promotable: false,
        diagnosticNote: noveltyNote({ text: candidate.text, kind, confidence: candidate.confidence, seenCount: 1 }),
        accepted: false
      };
      return {
        ...item,
        promotable: shouldBePromotable(item)
      };
    })
    .filter((item): item is SessionNoveltyItem => Boolean(item));

  return [...merged, ...newItems].slice(-16);
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
      hardConstraints: uniqueMeaningfulStrings([...state.stableCore.hardConstraints, ...constraints]).slice(0, 12),
      acceptedDecisions: uniqueMeaningfulStrings([...state.stableCore.acceptedDecisions, ...decisions]).slice(0, 12),
      outputContract: outputContract ?? state.stableCore.outputContract,
      lastUpdatedAt: timestamp
    },
    noveltyLane: remaining,
    updatedAt: timestamp
  };
}
