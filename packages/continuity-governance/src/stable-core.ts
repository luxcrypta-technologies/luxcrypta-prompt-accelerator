import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { TargetModel } from "@luxcrypta/continuity-types/models";
import type { SessionStableCore } from "@luxcrypta/continuity-types/governance";
import { firstMeaningfulLine, meaningSimilarity, uniqueMeaningfulStrings } from "@luxcrypta/continuity-types/utils/text";
import type { SessionCandidate } from "./types";
import { uniqueCandidateTexts } from "./partition";

export function isMeaningfullySimilar(left: string, right: string): boolean {
  return meaningSimilarity(left, right) >= 0.56;
}

// A latest "objective" that is actually a prompt-shell / engineering-note
// directive (not a real goal) must NOT replace an established objective. This
// guards the D1 fix so genuine objective CHANGES replace, but shell fragments
// (e.g. "At the end provide What Changed, Files Changed, Validation") do not.
const OBJECTIVE_SHELL_RE =
  /\b(at the end provide|what changed|files changed|live status|validation required|bad before|corrected after|final export|required (?:engineering )?note|copy this final prompt)\b/i;

function isShellObjective(text: string): boolean {
  const t = text.trim();
  if (t.length < 6) return true;
  // The literal sentinel must never be treated as a real objective candidate.
  if (t === "invalid_objective") return true;
  return OBJECTIVE_SHELL_RE.test(t);
}

function selectObjective(previous: SessionStableCore | undefined, objectives: string[]): string {
  // D1 fix: a meaningful new objective REPLACES the old; a restatement (similar)
  // keeps prior wording; a shell/sentinel fragment never replaces an established
  // objective. We pick the first *real* (non-shell, non-sentinel) candidate.
  const latest = objectives.find((objective) => !isShellObjective(objective));
  if (!previous?.objective) {
    return latest ?? objectives.find((o) => o.trim() !== "invalid_objective") ?? "Continue the active prompt session.";
  }
  if (!latest) return previous.objective;
  return isMeaningfullySimilar(previous.objective, latest) ? previous.objective : latest;
}

function selectOutputContract(previous: SessionStableCore | undefined, candidates: string[]): string | undefined {
  // Prefer a freshly-stated contract; fall back to the previous one. (Allows the
  // output contract to update, consistent with D1's objective behavior.)
  return candidates.find((candidate) => candidate.length <= 220) ?? previous?.outputContract;
}

const STABLE_LIST_CAP = 16;

function selectStableListWithOverflow(
  previousValues: string[] | undefined,
  candidates: string[],
  conservativeUpdates: boolean | undefined
): { items: string[]; overflow: number } {
  // D3 re-examined: this is NOT the bug it first looked like. New constraints
  // are *meant* to stage in the novelty lane and graduate into stable core via
  // promoteNoveltyItems() once they recur or are confirmed (the staging model).
  // Sweeping every first-mention candidate straight into stable here would
  // bypass that governance staging (and let a single mention rewrite stable
  // state). So conservative mode preserves established values plus candidates
  // already corroborated in stable; genuinely-new items wait in novelty.
  // Non-conservative mode (explicit) admits everything.
  const merged =
    !previousValues?.length || conservativeUpdates === false
      ? uniqueMeaningfulStrings([...(previousValues ?? []), ...candidates])
      : uniqueMeaningfulStrings([
          ...previousValues,
          ...candidates.filter((candidate) =>
            previousValues.some((previous) => isMeaningfullySimilar(previous, candidate))
          )
        ]);
  // D10: record overflow rather than silently slicing. The cap still bounds the
  // active list, but the count of dropped items is surfaced so a session that
  // legitimately exceeds the cap is visible, not silently truncated.
  const overflow = Math.max(0, merged.length - STABLE_LIST_CAP);
  return { items: merged.slice(0, STABLE_LIST_CAP), overflow };
}

function selectStableList(
  previousValues: string[] | undefined,
  candidates: string[],
  conservativeUpdates: boolean | undefined
): string[] {
  return selectStableListWithOverflow(previousValues, candidates, conservativeUpdates).items;
}

/**
 * D10: compute how many stable-core items were dropped by the cap this turn, so
 * the overflow is recorded in diagnostics rather than silently truncated.
 */
export function stableCoreCapOverflow(input: {
  previous?: SessionStableCore;
  stableCandidates: SessionCandidate[];
  conservativeUpdates?: boolean;
}): { constraints: number; decisions: number; total: number } {
  const constraints = uniqueCandidateTexts(input.stableCandidates, "constraint");
  const decisions = uniqueCandidateTexts(input.stableCandidates, "decision");
  const c = selectStableListWithOverflow(
    input.previous?.hardConstraints,
    constraints,
    input.conservativeUpdates
  ).overflow;
  const d = selectStableListWithOverflow(
    input.previous?.acceptedDecisions,
    decisions,
    input.conservativeUpdates
  ).overflow;
  return { constraints: c, decisions: d, total: c + d };
}

export function updateStableCore(input: {
  previous?: SessionStableCore;
  stableCandidates: SessionCandidate[];
  fallbackText?: string;
  preferredMode?: ModeName;
  preferredTargetModel?: TargetModel;
  conservativeUpdates?: boolean;
  timestamp: string;
}): SessionStableCore {
  const objectives = uniqueCandidateTexts(input.stableCandidates, "objective");
  const constraints = uniqueCandidateTexts(input.stableCandidates, "constraint");
  const decisions = uniqueCandidateTexts(input.stableCandidates, "decision");
  const outputContracts = uniqueCandidateTexts(input.stableCandidates, "output_contract");
  const fallbackObjective = input.fallbackText ? firstMeaningfulLine(input.fallbackText, "") : "";
  const objective = selectObjective(
    input.previous,
    objectives.length ? objectives : fallbackObjective ? [fallbackObjective] : []
  );

  return {
    objective,
    hardConstraints: selectStableList(input.previous?.hardConstraints, constraints, input.conservativeUpdates),
    acceptedDecisions: selectStableList(input.previous?.acceptedDecisions, decisions, input.conservativeUpdates),
    outputContract: selectOutputContract(input.previous, outputContracts),
    preferredMode: input.preferredMode ?? input.previous?.preferredMode,
    preferredTargetModel: input.preferredTargetModel ?? input.previous?.preferredTargetModel,
    lastUpdatedAt: input.timestamp
  };
}
