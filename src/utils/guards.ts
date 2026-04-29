import type { ExportBundle } from "@/types/messages";
import { MODE_NAMES } from "@/types/modes";
import { TARGET_MODELS } from "@/types/models";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { UserPreferences } from "@/types/preferences";
import type { Workflow } from "@/types/workflows";

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
    value.localOnlyMode === true &&
    isStringArray(value.supportedSurfaces) &&
    (value.defaultMode === undefined || isModeName(value.defaultMode)) &&
    (value.defaultTargetModel === undefined || isTargetModel(value.defaultTargetModel))
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
    (value.preferences === undefined || isUserPreferences(value.preferences))
  );
}
