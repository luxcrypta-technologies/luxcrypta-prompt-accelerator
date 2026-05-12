import type { ModeName } from "@/types/modes";
import type { TargetModel } from "@/types/models";
import type { SessionStableCore } from "@/types/governance";
import { firstMeaningfulLine, meaningSimilarity, uniqueMeaningfulStrings } from "@/utils/text";
import type { SessionCandidate } from "./types";
import { uniqueCandidateTexts } from "./partition";

export function isMeaningfullySimilar(left: string, right: string): boolean {
  return meaningSimilarity(left, right) >= 0.56;
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

function selectStableList(
  previousValues: string[] | undefined,
  candidates: string[],
  conservativeUpdates: boolean | undefined
): string[] {
  if (!previousValues?.length || conservativeUpdates === false) {
    return uniqueMeaningfulStrings([...(previousValues ?? []), ...candidates]).slice(0, 12);
  }
  const alreadyAccepted = candidates.filter((candidate) =>
    previousValues.some((previous) => isMeaningfullySimilar(previous, candidate))
  );
  return uniqueMeaningfulStrings([...previousValues, ...alreadyAccepted]).slice(0, 12);
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
    hardConstraints: selectStableList(input.previous?.hardConstraints, constraints, input.conservativeUpdates),
    acceptedDecisions: selectStableList(input.previous?.acceptedDecisions, decisions, input.conservativeUpdates),
    outputContract: selectOutputContract(input.previous, outputContracts),
    preferredMode: input.preferredMode ?? input.previous?.preferredMode,
    preferredTargetModel: input.preferredTargetModel ?? input.previous?.preferredTargetModel,
    lastUpdatedAt: input.timestamp
  };
}
