import type { ModeName } from "./modes";
import type { TargetModel } from "./models";

export interface UserPreferences {
  defaultMode?: ModeName;
  defaultTargetModel?: TargetModel;
  diffViewEnabled: boolean;
  contextualToolbarEnabled: boolean;
  saveHistoryEnabled: boolean;
  localOnlyMode: true;
  supportedSurfaces: string[];
}
