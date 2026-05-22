import type { UserPreferences } from "./preferences";

export const DEFAULT_CONTINUITY_PREFERENCES: UserPreferences = {
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
  supportedSurfaces: ["chatgpt", "claude", "gemini", "grok", "deepseek", "perplexity"]
};
