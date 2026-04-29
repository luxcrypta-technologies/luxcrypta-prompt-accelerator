import type { ModeName } from "@/types/modes";
import type { TargetModel } from "@/types/models";
import type { SessionStableCore } from "@/types/governance";
import { firstMeaningfulLine, uniqueStrings } from "@/utils/text";
import type { SessionCandidate } from "./types";
import { uniqueCandidateTexts } from "./partition";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isMeaningfullySimilar(left: string, right: string): boolean {
  const leftWords = new Set(normalize(left).split(" ").filter(Boolean));
  const rightWords = new Set(normalize(right).split(" ").filter(Boolean));
  if (!leftWords.size || !rightWords.size) return false;
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, rightWords.size) >= 0.56;
}

function selectObjective(previous: SessionStableCore | undefined, objectives: string[]): string {
  if (previous?.objective) {
    const similar = objectives.find((objective) => isMeaningfullySimilar(previous.objective, objective));
    return similar ? previous.objective : previous.objective;
  }
  return objectives[0] ?? "Continue the active prompt session.";
}

function selectOutputContract(previous: SessionStableCore | undefined, candidates: string[]): string | undefined {
  return previous?.outputContract ?? candidates.find((candidate) => candidate.length <= 220);
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
  const objective =
    input.conservativeUpdates === false
      ? objectives[0] ?? input.previous?.objective ?? fallbackObjective ?? "Continue the active prompt session."
      : selectObjective(input.previous, objectives.length ? objectives : fallbackObjective ? [fallbackObjective] : []);

  return {
    objective,
    hardConstraints: uniqueStrings([...(input.previous?.hardConstraints ?? []), ...constraints]).slice(0, 12),
    acceptedDecisions: uniqueStrings([...(input.previous?.acceptedDecisions ?? []), ...decisions]).slice(0, 12),
    outputContract: selectOutputContract(input.previous, outputContracts),
    preferredMode: input.preferredMode ?? input.previous?.preferredMode,
    preferredTargetModel: input.preferredTargetModel ?? input.previous?.preferredTargetModel,
    lastUpdatedAt: input.timestamp
  };
}
