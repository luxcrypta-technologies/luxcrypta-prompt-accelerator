import type { ExportBundle } from "./bundles";
import { MODE_NAMES } from "./modes";
import { TARGET_MODELS } from "./models";
import type { CarryForwardCapsule } from "./capsules";
import type { DiagnosticSnapshot } from "./diagnostics";
import type {
  SessionDiagnostics,
  SessionGovernanceState,
  SessionMonitors,
  SessionNoveltyItem,
  SessionOpennessState,
  SessionStableCore
} from "./governance";
import type { UserPreferences } from "./preferences";
import type { Workflow } from "./workflows";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isModeName(value: unknown): boolean {
  return typeof value === "string" && MODE_NAMES.includes(value as never);
}

export function isTargetModel(value: unknown): boolean {
  return typeof value === "string" && TARGET_MODELS.includes(value as never);
}

export function isUserPreferences(value: unknown): value is UserPreferences {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.diffViewEnabled === "boolean" &&
    typeof value.contextualToolbarEnabled === "boolean" &&
    typeof value.saveHistoryEnabled === "boolean" &&
    (value.sessionGovernanceEnabled === undefined || typeof value.sessionGovernanceEnabled === "boolean") &&
    (value.showAdvancedDiagnostics === undefined || typeof value.showAdvancedDiagnostics === "boolean") &&
    (value.preserveOpenQuestions === undefined || typeof value.preserveOpenQuestions === "boolean") &&
    (value.conservativeStableCoreUpdates === undefined || typeof value.conservativeStableCoreUpdates === "boolean") &&
    (value.saveSessionStateLocally === undefined || typeof value.saveSessionStateLocally === "boolean") &&
    value.localOnlyMode === true &&
    isStringArray(value.supportedSurfaces) &&
    (value.defaultMode === undefined || isModeName(value.defaultMode)) &&
    (value.defaultTargetModel === undefined || isTargetModel(value.defaultTargetModel))
  );
}

export function isSessionStableCore(value: unknown): value is SessionStableCore {
  if (!isRecord(value)) return false;
  return (
    typeof value.objective === "string" &&
    isStringArray(value.hardConstraints) &&
    isStringArray(value.acceptedDecisions) &&
    (value.outputContract === undefined || typeof value.outputContract === "string") &&
    (value.preferredMode === undefined || isModeName(value.preferredMode)) &&
    (value.preferredTargetModel === undefined || isTargetModel(value.preferredTargetModel)) &&
    typeof value.lastUpdatedAt === "string"
  );
}

export function isSessionNoveltyItem(value: unknown): value is SessionNoveltyItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.kind === "string" &&
    typeof value.confidence === "number" &&
    typeof value.source === "string" &&
    typeof value.createdAt === "string" &&
    (value.accepted === undefined || typeof value.accepted === "boolean")
  );
}

export function isSessionOpennessState(value: unknown): value is SessionOpennessState {
  if (!isRecord(value)) return false;
  return (
    isStringArray(value.openQuestions) &&
    isStringArray(value.uncertaintyNotes) &&
    isStringArray(value.optionalBranches) &&
    typeof value.preservedCreativeSpace === "boolean" &&
    typeof value.lastUpdatedAt === "string"
  );
}

export function isSessionMonitors(value: unknown): value is SessionMonitors {
  if (!isRecord(value)) return false;
  return (
    typeof value.continuityScore === "number" &&
    typeof value.driftScore === "number" &&
    typeof value.noveltyLoad === "number" &&
    typeof value.opennessScore === "number" &&
    typeof value.compressionDensity === "number" &&
    (value.sessionHealth === "healthy" || value.sessionHealth === "watch" || value.sessionHealth === "unstable")
  );
}

export function isSessionDiagnostics(value: unknown): value is SessionDiagnostics {
  if (!isRecord(value)) return false;
  return (
    isStringArray(value.stableCoreSummary) &&
    isStringArray(value.noveltySummary) &&
    isStringArray(value.opennessSummary) &&
    isStringArray(value.warnings) &&
    isStringArray(value.actionsSuggested) &&
    typeof value.generatedAt === "string"
  );
}

export function isSessionGovernanceState(value: unknown): value is SessionGovernanceState {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    (value.title === undefined || typeof value.title === "string") &&
    isSessionStableCore(value.stableCore) &&
    Array.isArray(value.noveltyLane) &&
    value.noveltyLane.every(isSessionNoveltyItem) &&
    isSessionOpennessState(value.opennessLane) &&
    isSessionMonitors(value.monitors) &&
    isSessionDiagnostics(value.diagnostics) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function isDiagnosticSnapshot(value: unknown): value is DiagnosticSnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.sessionId === "string" &&
    isSessionDiagnostics(value.diagnostics) &&
    typeof value.createdAt === "string"
  );
}

export function isWorkflow(value: unknown): value is Workflow {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.objective === "string" &&
    isModeName(value.mode) &&
    isStringArray(value.constraints) &&
    isStringArray(value.outputPreferences) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.carryForwardContext === undefined || typeof value.carryForwardContext === "string") &&
    (value.targetModel === undefined || isTargetModel(value.targetModel)) &&
    (value.tags === undefined || isStringArray(value.tags))
  );
}

export function isCarryForwardCapsule(value: unknown): value is CarryForwardCapsule {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.capsule_version === 1 &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.objective === "string" &&
    isStringArray(value.constraints) &&
    isStringArray(value.decisions) &&
    isStringArray(value.open_questions) &&
    typeof value.created_at === "string" &&
    (value.preferred_mode === undefined || isModeName(value.preferred_mode)) &&
    (value.notes === undefined || typeof value.notes === "string") &&
    (value.sourceSurface === undefined || typeof value.sourceSurface === "string") &&
    (value.updated_at === undefined || typeof value.updated_at === "string")
  );
}

export function isExportBundle(value: unknown): value is ExportBundle {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.version === 1 &&
    typeof value.exportedAt === "string" &&
    Array.isArray(value.workflows) &&
    value.workflows.every(isWorkflow) &&
    Array.isArray(value.capsules) &&
    value.capsules.every(isCarryForwardCapsule) &&
    (value.preferences === undefined || isUserPreferences(value.preferences)) &&
    (value.sessions === undefined ||
      (Array.isArray(value.sessions) && value.sessions.every(isSessionGovernanceState))) &&
    (value.diagnostics === undefined ||
      (Array.isArray(value.diagnostics) && value.diagnostics.every(isDiagnosticSnapshot)))
  );
}
