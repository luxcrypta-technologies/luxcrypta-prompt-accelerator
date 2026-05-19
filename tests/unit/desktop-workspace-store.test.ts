import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DesktopWorkspaceRepository } from "../../apps/desktop/electron/workspace-store";

describe("desktop workspace store", () => {
  it("persists workspaces, sessions, capsules, and handoff exports as versioned local JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpa-desktop-"));
    const importRoot = await mkdtemp(join(tmpdir(), "lxpa-desktop-import-"));
    try {
      const repo = new DesktopWorkspaceRepository(root);
      const initial = await repo.getState();

      expect(initial.activeWorkspace.schemaVersion).toBe(1);
      expect(initial.workspaces).toHaveLength(1);

      const updated = await repo.updateSession({
        sourceText:
          "Objective: maintain a desktop continuity console. Must preserve local files only. Decision: JSON is acceptable for MVP. What remains unresolved?",
        mode: "focus",
        target: "claude"
      });

      expect(updated.state.currentSession?.stableCore.objective).toContain("desktop continuity console");
      expect(updated.state.currentSession?.stableCore.preferredTargetModel).toBe("claude");

      const withCapsule = await repo.saveCapsuleFromCurrent();
      expect(withCapsule.capsules[0]?.capsule_version).toBe(1);

      const handoff = await repo.generateHandoff({ target: "grok" });
      expect(handoff.text).toContain("Grok Continuity Handoff");

      const renamed = await repo.renameActiveWorkspace("Renamed Workspace");
      expect(renamed.activeWorkspace.title).toBe("Renamed Workspace");

      const exportPath = join(root, "workspace-export.json");
      const exported = await repo.exportActiveWorkspace(exportPath);
      expect(exported.path).toBe(exportPath);

      const workspacePath = join(root, initial.activeWorkspace.id, "workspace.json");
      const workspaceFile = JSON.parse(await readFile(workspacePath, "utf8"));
      expect(workspaceFile.schemaVersion).toBe(1);
      expect(workspaceFile.data.activeSessionId).toBe(updated.state.currentSession?.id);

      const importedRepo = new DesktopWorkspaceRepository(importRoot);
      const imported = await importedRepo.importIntoActiveWorkspace(exportPath);
      expect(imported.state.capsules[0]?.objective).toContain("desktop continuity console");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(importRoot, { recursive: true, force: true });
    }
  });

  it("ignores malformed JSON instead of crashing workspace load", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpa-desktop-corrupt-"));
    try {
      const repo = new DesktopWorkspaceRepository(root);
      const state = await repo.getState();
      const corruptPath = join(root, state.activeWorkspace.id, "capsules", "broken.json");
      await mkdir(join(root, state.activeWorkspace.id, "capsules"), { recursive: true });
      await writeFile(corruptPath, "{not valid json", "utf8");

      await expect(repo.getState()).resolves.toMatchObject({
        activeWorkspace: { id: state.activeWorkspace.id }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects malformed workspace imports with a clear error", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpa-desktop-bad-import-"));
    try {
      const repo = new DesktopWorkspaceRepository(root);
      await repo.getState();
      const badImportPath = join(root, "bad-import.json");
      await writeFile(badImportPath, "{not valid json", "utf8");

      await expect(repo.importIntoActiveWorkspace(badImportPath)).rejects.toThrow("Import file is not valid JSON");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
