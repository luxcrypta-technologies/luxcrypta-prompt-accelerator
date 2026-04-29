import type { ModeName } from "./modes";
import type { TargetModel } from "./models";

export interface UserPreferences {
  defaultMode?: ModeName;
  defaultTargetModel?: TargetModel;
  diffViewEnabled: boolean;
  contextualToolbarEnabled: boolean;
  saveHistoryEnabled: boolean;
  sessionGovernanceEnabled: boolean;
  showAdvancedDiagnostics: boolean;
  preserveOpenQuestions: boolean;
  conservativeStableCoreUpdates: boolean;
  saveSessionStateLocally: boolean;
  localOnlyMode: true;
  supportedSurfaces: string[];
}
