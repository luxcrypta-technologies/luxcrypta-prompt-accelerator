import { CapsuleStore } from "@/storage/capsule-store";
import { PreferenceStore } from "@/storage/preference-store";
import { WorkflowStore } from "@/storage/workflow-store";
import type { ExportBundle, ImportBundleResult } from "@/types/messages";
import type { PlatformStorage } from "@/types/platform";
import { isExportBundle } from "@/utils/guards";
import { nowIso } from "@/utils/time";

export async function executeExportBundle(deps: { storage: PlatformStorage }): Promise<ExportBundle> {
  const workflows = await new WorkflowStore(deps.storage).list();
  const capsules = await new CapsuleStore(deps.storage).list();
  const preferences = await new PreferenceStore(deps.storage).get();
  return {
    version: 1,
    exportedAt: nowIso(),
    workflows,
    capsules,
    preferences
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

  await Promise.all(bundle.workflows.map((workflow) => workflowStore.save(workflow)));
  await Promise.all(bundle.capsules.map((capsule) => capsuleStore.save(capsule)));
  if (bundle.preferences) {
    await preferenceStore.update(bundle.preferences);
  }

  return {
    workflowsImported: bundle.workflows.length,
    capsulesImported: bundle.capsules.length,
    preferencesImported: Boolean(bundle.preferences)
  };
}
