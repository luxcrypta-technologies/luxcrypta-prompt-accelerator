import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DesktopWorkspaceRepository } from "../../apps/desktop/electron/workspace-store";

describe("desktop workspace store", () => {
  it("persists workspaces, sessions, capsules, and handoff exports as versioned local JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "lxpa-desktop-"));
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

      const workspacePath = join(root, initial.activeWorkspace.id, "workspace.json");
      const workspaceFile = JSON.parse(await readFile(workspacePath, "utf8"));
      expect(workspaceFile.schemaVersion).toBe(1);
      expect(workspaceFile.data.activeSessionId).toBe(updated.state.currentSession?.id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
