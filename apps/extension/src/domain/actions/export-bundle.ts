import { CapsuleStore } from "@/storage/capsule-store";
import { DiagnosticsStore } from "@/storage/diagnostics-store";
import { PreferenceStore } from "@/storage/preference-store";
import { SessionStore } from "@/storage/session-store";
import { WorkflowStore } from "@/storage/workflow-store";
import type { ExportBundle, ImportBundleResult } from "@/types/messages";
import type { PlatformStorage } from "@/types/platform";
import { isExportBundle } from "@/utils/guards";
import { nowIso } from "@/utils/time";

export async function executeExportBundle(deps: { storage: PlatformStorage }): Promise<ExportBundle> {
  const workflows = await new WorkflowStore(deps.storage).list();
  const capsules = await new CapsuleStore(deps.storage).list();
  const preferences = await new PreferenceStore(deps.storage).get();
  const sessions = await new SessionStore(deps.storage).list();
  const diagnostics = await new DiagnosticsStore(deps.storage).list();
  return {
    version: 1,
    exportedAt: nowIso(),
    workflows,
    capsules,
    preferences,
    sessions,
    diagnostics
  };
}

export function validateImportBundle(value: unknown): ExportBundle {
  if (!isExportBundle(value)) {
    throw new Error("Import file is not a valid Prompt Accelerator bundle.");
  }
  return value;
}

export async function executeImportBundle(
  value: unknown,
  deps: { storage: PlatformStorage }
): Promise<ImportBundleResult> {
  const bundle = validateImportBundle(value);
  const workflowStore = new WorkflowStore(deps.storage);
  const capsuleStore = new CapsuleStore(deps.storage);
  const preferenceStore = new PreferenceStore(deps.storage);
  const sessionStore = new SessionStore(deps.storage);
  const diagnosticsStore = new DiagnosticsStore(deps.storage);

  await Promise.all(bundle.workflows.map((workflow) => workflowStore.save(workflow)));
  await Promise.all(bundle.capsules.map((capsule) => capsuleStore.save(capsule)));
  await Promise.all((bundle.sessions ?? []).map((session) => sessionStore.save(session)));
  await Promise.all((bundle.diagnostics ?? []).map((diagnostic) => diagnosticsStore.save(diagnostic)));
  if (bundle.preferences) {
    await preferenceStore.update(bundle.preferences);
  }

  return {
    workflowsImported: bundle.workflows.length,
    capsulesImported: bundle.capsules.length,
    preferencesImported: Boolean(bundle.preferences),
    sessionsImported: bundle.sessions?.length ?? 0,
    diagnosticsImported: bundle.diagnostics?.length ?? 0
  };
}
