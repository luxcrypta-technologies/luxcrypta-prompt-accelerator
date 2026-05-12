import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { executePromoteNovelty } from "@luxcrypta/continuity-domain/actions/promote-novelty";
import { executeTransformPrompt } from "@luxcrypta/continuity-domain/actions/transform-prompt";
import { executeUpdateSessionState } from "@luxcrypta/continuity-domain/actions/update-session-state";
import { WorkflowService } from "@luxcrypta/continuity-domain/services/workflow-service";
import { createCarryForwardFromGovernance } from "@luxcrypta/continuity-governance/carry-forward";
import { CapsuleStore } from "@luxcrypta/continuity-storage/capsule-store";
import { DiagnosticsStore } from "@luxcrypta/continuity-storage/diagnostics-store";
import { SessionStore } from "@luxcrypta/continuity-storage/session-store";
import { WorkflowStore } from "@luxcrypta/continuity-storage/workflow-store";
import { CURRENT_SESSION_KEY, STORAGE_PREFIXES } from "@luxcrypta/continuity-storage/keys";
import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import { createDatedId } from "@luxcrypta/continuity-types/utils/ids";
import { nowIso } from "@luxcrypta/continuity-types/utils/time";
import type { Workflow } from "@luxcrypta/continuity-types/workflows";
import { buildContinuityHandoff, PROVIDER_TARGETS, type ContinuityHandoff, type ProviderTarget } from "@luxcrypta/continuity-routing";
import type {
  DesktopSessionUpdateInput,
  DesktopSessionUpdateResult,
  DesktopState,
  DesktopWorkflowInput,
  DesktopWorkspace
} from "../src/desktop-api";

interface VersionedRecord<T> {
  schemaVersion: 1;
  data: T;
}

interface DesktopSettings {
  activeWorkspaceId?: string;
}

const DIRECTORY_BY_PREFIX: Record<string, string> = {
  [STORAGE_PREFIXES.workflow]: "workflows",
  [STORAGE_PREFIXES.capsule]: "capsules",
  [STORAGE_PREFIXES.history]: "history",
  [STORAGE_PREFIXES.preference]: "preferences",
  [STORAGE_PREFIXES.session]: "sessions",
  [STORAGE_PREFIXES.diagnostic]: "diagnostics"
};

function wrap<T>(data: T): VersionedRecord<T> {
  return { schemaVersion: 1, data };
}

function unwrap<T>(value: unknown): T {
  if (value && typeof value === "object" && "schemaVersion" in value && "data" in value) {
    return (value as VersionedRecord<T>).data;
  }
  return value as T;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

async function readJson<T>(path: string): Promise<T | null> {
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf8");
  return unwrap<T>(JSON.parse(raw));
}

async function writeJson<T>(path: string, value: T): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(wrap(value), null, 2)}\n`, "utf8");
}

class WorkspaceFileStorage implements ContinuityStorage {
  constructor(
    private readonly workspacePath: string,
    private readonly onCurrentSession: (sessionId: string) => Promise<void>
  ) {}

  async get<T>(key: string): Promise<T | null> {
    return readJson<T>(this.pathForKey(key));
  }

  async set<T>(key: string, value: T): Promise<void> {
    await writeJson(this.pathForKey(key), value);
    if (key === CURRENT_SESSION_KEY && value && typeof value === "object" && "id" in value) {
      await this.onCurrentSession(String((value as { id: string }).id));
    }
  }

  async remove(key: string): Promise<void> {
    const { rm } = await import("node:fs/promises");
    await rm(this.pathForKey(key), { force: true });
  }

  async list<T>(prefix: string): Promise<T[]> {
    const dir = join(this.workspacePath, this.directoryForPrefix(prefix));
    if (!existsSync(dir)) return [];
    const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
    const values: T[] = [];
    for (const file of files) {
      const value = await readJson<T>(join(dir, file));
      if (value !== null) values.push(value);
    }
    return values;
  }

  private pathForKey(key: string): string {
    const prefix = this.prefixForKey(key);
    const suffix = key.slice(prefix.length) || "default";
    return join(this.workspacePath, this.directoryForPrefix(prefix), `${safeFileName(suffix)}.json`);
  }

  private prefixForKey(key: string): string {
    const prefix = Object.keys(DIRECTORY_BY_PREFIX).find((candidate) => key.startsWith(candidate));
    if (!prefix) throw new Error(`Unsupported continuity storage key: ${key}`);
    return prefix;
  }

  private directoryForPrefix(prefix: string): string {
    return DIRECTORY_BY_PREFIX[prefix] ?? "kv";
  }
}

export class DesktopWorkspaceRepository {
  private readonly settingsPath: string;

  constructor(private readonly rootPath: string) {
    this.settingsPath = join(rootPath, "settings.json");
  }

  async getState(): Promise<DesktopState> {
    await this.ensureRoot();
    const workspaces = await this.listWorkspaces();
    if (!workspaces.length) {
      return this.createWorkspace("Continuity Workspace");
    }
    const settings = await this.readSettings();
    const activeWorkspace = workspaces.find((workspace) => workspace.id === settings.activeWorkspaceId) ?? workspaces[0];
    return this.loadState(activeWorkspace.id);
  }

  async createWorkspace(title: string): Promise<DesktopState> {
    await this.ensureRoot();
    const timestamp = nowIso();
    const workspace: DesktopWorkspace = {
      schemaVersion: 1,
      id: createDatedId("workspace", title, timestamp),
      title: title.trim() || "Continuity Workspace",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const workspacePath = this.workspacePath(workspace.id);
    await mkdir(workspacePath, { recursive: true });
    await Promise.all(["sessions", "capsules", "workflows", "diagnostics", "exports", "history", "preferences"].map((dir) => mkdir(join(workspacePath, dir), { recursive: true })));
    await this.saveWorkspace(workspace);
    await this.writeSettings({ activeWorkspaceId: workspace.id });
    return this.loadState(workspace.id);
  }

  async switchWorkspace(id: string): Promise<DesktopState> {
    const workspaces = await this.listWorkspaces();
    if (!workspaces.some((workspace) => workspace.id === id)) {
      throw new Error("Workspace not found.");
    }
    await this.writeSettings({ activeWorkspaceId: id });
    return this.loadState(id);
  }

  async updateSession(input: DesktopSessionUpdateInput): Promise<DesktopSessionUpdateResult> {
    const state = await this.getState();
    const storage = this.storageFor(state.activeWorkspace.id);
    const request = {
      sourceText: input.sourceText,
      mode: input.mode,
      targetModel: input.target,
      preserveConstraints: true,
      generateDiff: true,
      generateExplanation: true,
      sourceSurface: "desktop"
    };
    const transform = await executeTransformPrompt(request, { storage });
    await executeUpdateSessionState(
      {
        transformRequest: request,
        transformResult: transform,
        sourceSurface: "desktop"
      },
      { storage }
    );
    return { transform, state: await this.loadState(state.activeWorkspace.id) };
  }

  async promoteNovelty(ids: string[]): Promise<DesktopState> {
    const state = await this.getState();
    await executePromoteNovelty({ noveltyIds: ids }, { storage: this.storageFor(state.activeWorkspace.id) });
    return this.loadState(state.activeWorkspace.id);
  }

  async saveCapsuleFromCurrent(): Promise<DesktopState> {
    const state = await this.getState();
    if (!state.currentSession) throw new Error("Create or update a session before saving a capsule.");
    const capsule = createCarryForwardFromGovernance(state.currentSession);
    await new CapsuleStore(this.storageFor(state.activeWorkspace.id)).save(capsule);
    return this.loadState(state.activeWorkspace.id);
  }

  async saveCapsule(capsule: CarryForwardCapsule): Promise<DesktopState> {
    const state = await this.getState();
    const timestamp = nowIso();
    await new CapsuleStore(this.storageFor(state.activeWorkspace.id)).save({
      ...capsule,
      capsule_version: 1,
      updated_at: timestamp
    });
    return this.loadState(state.activeWorkspace.id);
  }

  async saveWorkflow(input: DesktopWorkflowInput): Promise<DesktopState> {
    const state = await this.getState();
    await new WorkflowService(this.storageFor(state.activeWorkspace.id)).save(input);
    return this.loadState(state.activeWorkspace.id);
  }

  async applyWorkflow(id: string): Promise<DesktopSessionUpdateResult> {
    const state = await this.getState();
    const workflow = state.workflows.find((item) => item.id === id);
    if (!workflow) throw new Error("Workflow not found.");
    return this.updateSession({
      sourceText: this.workflowPrompt(workflow),
      mode: workflow.mode,
      target: (workflow.targetModel === "chatgpt" || workflow.targetModel === "claude" || workflow.targetModel === "gemini" || workflow.targetModel === "grok"
        ? workflow.targetModel
        : "chatgpt") as ProviderTarget
    });
  }

  async generateHandoff(input: { target: ProviderTarget; capsuleId?: string; workflowId?: string; notes?: string }): Promise<ContinuityHandoff> {
    const state = await this.getState();
    const capsule = input.capsuleId ? state.capsules.find((item) => item.id === input.capsuleId) ?? null : state.capsules[0] ?? null;
    const workflow = input.workflowId ? state.workflows.find((item) => item.id === input.workflowId) ?? null : null;
    const handoff = buildContinuityHandoff({
      target: input.target,
      session: state.currentSession,
      capsule,
      workflow,
      notes: input.notes
    });
    await this.saveExport(state.activeWorkspace.id, handoff);
    return handoff;
  }

  private async loadState(workspaceId: string): Promise<DesktopState> {
    const workspace = await this.readWorkspace(workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    const storage = this.storageFor(workspaceId);
    const sessions = await new SessionStore(storage).list();
    const currentSession = (await new SessionStore(storage).getCurrent()) ?? sessions[0] ?? null;
    const capsules = await new CapsuleStore(storage).list();
    const workflows = await new WorkflowStore(storage).list();
    const handoff = buildContinuityHandoff({
      target: currentSession?.stableCore.preferredTargetModel === "claude" || currentSession?.stableCore.preferredTargetModel === "gemini" || currentSession?.stableCore.preferredTargetModel === "grok"
        ? currentSession.stableCore.preferredTargetModel
        : "chatgpt",
      session: currentSession,
      capsule: capsules[0] ?? null
    });
    return {
      workspaces: await this.listWorkspaces(),
      activeWorkspace: workspace,
      currentSession,
      capsules,
      workflows,
      providerTargets: PROVIDER_TARGETS,
      handoff
    };
  }

  private storageFor(workspaceId: string): ContinuityStorage {
    return new WorkspaceFileStorage(this.workspacePath(workspaceId), async (sessionId) => {
      const workspace = await this.readWorkspace(workspaceId);
      if (!workspace) return;
      await this.saveWorkspace({ ...workspace, activeSessionId: sessionId, updatedAt: nowIso() });
    });
  }

  private workflowPrompt(workflow: Workflow): string {
    return [
      `Objective: ${workflow.objective}`,
      workflow.constraints.length ? `Hard requirements:\n${workflow.constraints.map((item) => `- ${item}`).join("\n")}` : "",
      workflow.outputPreferences.length ? `Output contract:\n${workflow.outputPreferences.map((item) => `- ${item}`).join("\n")}` : "",
      workflow.carryForwardContext ? `Context:\n${workflow.carryForwardContext}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private async saveExport(workspaceId: string, handoff: ContinuityHandoff): Promise<void> {
    const timestamp = nowIso();
    const exportPath = join(this.workspacePath(workspaceId), "exports", `${safeFileName(`${handoff.target}_${timestamp}`)}.json`);
    await writeJson(exportPath, { exportedAt: timestamp, handoff });
  }

  private async ensureRoot(): Promise<void> {
    await mkdir(this.rootPath, { recursive: true });
  }

  private workspacePath(id: string): string {
    return join(this.rootPath, id);
  }

  private async listWorkspaces(): Promise<DesktopWorkspace[]> {
    if (!existsSync(this.rootPath)) return [];
    const entries = await readdir(this.rootPath, { withFileTypes: true });
    const workspaces = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => this.readWorkspace(entry.name))
    );
    return workspaces
      .filter((workspace): workspace is DesktopWorkspace => Boolean(workspace))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private async readWorkspace(id: string): Promise<DesktopWorkspace | null> {
    return readJson<DesktopWorkspace>(join(this.workspacePath(id), "workspace.json"));
  }

  private async saveWorkspace(workspace: DesktopWorkspace): Promise<void> {
    await writeJson(join(this.workspacePath(workspace.id), "workspace.json"), workspace);
  }

  private async readSettings(): Promise<DesktopSettings> {
    return (await readJson<DesktopSettings>(this.settingsPath)) ?? {};
  }

  private async writeSettings(settings: DesktopSettings): Promise<void> {
    await writeJson(this.settingsPath, settings);
  }
}
