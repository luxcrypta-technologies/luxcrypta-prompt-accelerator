import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { TargetModel } from "@luxcrypta/continuity-types/models";
import type { SessionStableCore } from "@luxcrypta/continuity-types/governance";
import { firstMeaningfulLine, meaningSimilarity, uniqueMeaningfulStrings } from "@luxcrypta/continuity-types/utils/text";
import type { SessionCandidate } from "./types";
import { uniqueCandidateTexts } from "./partition";

export function isMeaningfullySimilar(left: string, right: string): boolean {
  return meaningSimilarity(left, right) >= 0.56;
}

// Stopwords that carry no topic signal; ignored when comparing objective topics.
const TOPIC_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "as",
  "it", "is", "be", "this", "that", "i", "you", "we", "my", "your", "our",
  "plan", "build", "create", "design", "make", "more", "detail", "details",
  "objective", "please", "help", "want", "need", "would", "like", "into",
  "program", "routine", "project", "task", "day", "days"
]);

function topicWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !TOPIC_STOPWORDS.has(w))
  );
}

/**
 * Conservative topic-change test for the F4 objective-pivot guard. Returns true
 * only when two objectives share almost none of their salient content words —
 * i.e. a genuine wholesale topic change (hot yoga -> microgrid), NOT a
 * restatement or refinement. Deliberately strict: when in doubt it returns
 * false so stable-core is preserved (losing real state is worse than keeping a
 * little stale state). Also requires each side to have real topic content, so an
 * empty/shell objective never triggers a reset.
 */
export function isWholesaleObjectiveChange(previous: string, next: string): boolean {
  const prev = topicWords(previous);
  const cur = topicWords(next);
  if (prev.size < 2 || cur.size < 2) return false;
  let shared = 0;
  for (const w of cur) {
    if (prev.has(w)) shared += 1;
  }
  const overlap = shared / Math.min(prev.size, cur.size);
  // Strong signal: <15% salient-word overlap means the topic genuinely changed.
  return overlap < 0.15;
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

  // F4 fix: detect a WHOLESALE objective pivot (a clear topic change), and only
  // then drop the previous topic's stable-core. We use a CONSERVATIVE signal:
  // the new objective must share almost no salient content with the old one
  // (e.g. "hot yoga program" -> "microgrid architecture"). Borderline cases
  // (restatements/refinements, where objective strings may also carry trailing
  // constraint text) preserve carry-forward — dropping on ambiguity would lose
  // real state, which is worse than keeping it. This catches the live fused-
  // session contamination without over-resetting on legitimate continuations.
  const objectivePivoted =
    Boolean(input.previous?.objective) &&
    Boolean(objective) &&
    isWholesaleObjectiveChange(input.previous!.objective, objective);
  const carriedConstraints = objectivePivoted ? undefined : input.previous?.hardConstraints;
  const carriedDecisions = objectivePivoted ? undefined : input.previous?.acceptedDecisions;

  return {
    objective,
    hardConstraints: selectStableList(carriedConstraints, constraints, input.conservativeUpdates),
    acceptedDecisions: selectStableList(carriedDecisions, decisions, input.conservativeUpdates),
    outputContract: objectivePivoted
      ? selectOutputContract(undefined, outputContracts)
      : selectOutputContract(input.previous, outputContracts),
    preferredMode: input.preferredMode ?? input.previous?.preferredMode,
    preferredTargetModel: input.preferredTargetModel ?? input.previous?.preferredTargetModel,
    lastUpdatedAt: input.timestamp
  };
}
