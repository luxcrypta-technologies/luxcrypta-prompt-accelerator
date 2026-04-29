import type { UserPreferences } from "@/types/preferences";
import { SUPPORTED_SURFACES } from "./constants";

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultMode: "focus",
  defaultTargetModel: "generic",
  diffViewEnabled: true,
  contextualToolbarEnabled: true,
  saveHistoryEnabled: false,
  sessionGovernanceEnabled: true,
  showAdvancedDiagnostics: false,
  preserveOpenQuestions: true,
  conservativeStableCoreUpdates: true,
  saveSessionStateLocally: true,
  localOnlyMode: true,
  supportedSurfaces: SUPPORTED_SURFACES.map((surface) => surface.id)
};

export const REVIEW_STATE_LIMIT = 20;
