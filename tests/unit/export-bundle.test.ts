import { describe, expect, it } from "vitest";
import { executeExportBundle, executeImportBundle, validateImportBundle } from "@/domain/actions/export-bundle";
import { CapsuleStore } from "@/storage/capsule-store";
import { PreferenceStore } from "@/storage/preference-store";
import { WorkflowStore } from "@/storage/workflow-store";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { ExportBundle } from "@/types/messages";
import type { PlatformStorage } from "@/types/platform";
import type { Workflow } from "@/types/workflows";

class MemoryStorage implements PlatformStorage {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list<T>(prefix: string): Promise<T[]> {
    return Array.from(this.values.entries())
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value as T);
  }
}

const workflow: Workflow = {
  id: "workflow_import_test",
  title: "Research plan",
  objective: "Build a concise research plan",
  mode: "research",
  constraints: ["Citations required"],
  outputPreferences: ["Bullet points only"],
  targetModel: "generic",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const capsule: CarryForwardCapsule = {
  capsule_version: 1,
  id: "capsule_import_test",
  title: "Research carry-forward",
  objective: "Continue the research plan",
  constraints: ["Keep uncertainty visible"],
  decisions: ["Use bullet points"],
  open_questions: ["Which sources are available?"],
  preferred_mode: "research",
  created_at: "2026-01-01T00:00:00.000Z"
};

function bundle(): ExportBundle {
  return {
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    workflows: [workflow],
    capsules: [capsule],
    preferences: {
      defaultMode: "precision",
      defaultTargetModel: "claude",
      diffViewEnabled: false,
      contextualToolbarEnabled: true,
      saveHistoryEnabled: true,
      localOnlyMode: true,
      supportedSurfaces: ["chatgpt", "claude", "gemini"]
    }
  };
}

describe("export bundle actions", () => {
  it("imports workflows, capsules, and preferences deterministically", async () => {
    const storage = new MemoryStorage();
    const result = await executeImportBundle(bundle(), { storage });

    await expect(new WorkflowStore(storage).get(workflow.id)).resolves.toEqual(workflow);
    await expect(new CapsuleStore(storage).get(capsule.id)).resolves.toEqual(capsule);
    await expect(new PreferenceStore(storage).get()).resolves.toMatchObject({
      defaultMode: "precision",
      defaultTargetModel: "claude",
      saveHistoryEnabled: true,
      localOnlyMode: true
    });
    expect(result).toEqual({
      workflowsImported: 1,
      capsulesImported: 1,
      preferencesImported: true
    });
  });

  it("exports the same local bundle shape", async () => {
    const storage = new MemoryStorage();
    await executeImportBundle(bundle(), { storage });

    const exported = await executeExportBundle({ storage });

    expect(exported.version).toBe(1);
    expect(exported.workflows).toEqual([workflow]);
    expect(exported.capsules).toEqual([capsule]);
    expect(exported.preferences?.localOnlyMode).toBe(true);
  });

  it("rejects malformed import bundles before writing", () => {
    expect(() =>
      validateImportBundle({
        version: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        workflows: [{ id: "missing-required-fields" }],
        capsules: []
      })
    ).toThrow("Import file is not a valid Prompt Accelerator bundle.");
  });
});
