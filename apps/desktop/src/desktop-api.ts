import type { CarryForwardCapsule } from "@luxcrypta/continuity-types/capsules";
import type { SessionGovernanceState } from "@luxcrypta/continuity-types/governance";
import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { TransformResult } from "@luxcrypta/continuity-types/prompts";
import type { Workflow } from "@luxcrypta/continuity-types/workflows";
import type { ContinuityHandoff, ProviderTarget } from "@luxcrypta/continuity-routing";

export interface DesktopWorkspace {
  schemaVersion: 1;
  id: string;
  title: string;
  activeSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesktopState {
  workspaces: DesktopWorkspace[];
  activeWorkspace: DesktopWorkspace;
  currentSession: SessionGovernanceState | null;
  capsules: CarryForwardCapsule[];
  workflows: Workflow[];
  providerTargets: ProviderTarget[];
  handoff: ContinuityHandoff | null;
}

export interface DesktopSessionUpdateInput {
  sourceText: string;
  mode?: ModeName;
  target: ProviderTarget;
}

export interface DesktopSessionUpdateResult {
  transform: TransformResult;
  state: DesktopState;
}

export interface DesktopWorkflowInput {
  title: string;
  objective: string;
  mode: ModeName;
  constraints: string[];
  outputPreferences: string[];
  carryForwardContext?: string;
  targetModel?: ProviderTarget;
  tags?: string[];
}

export interface DesktopApi {
  getState(): Promise<DesktopState>;
  createWorkspace(title: string): Promise<DesktopState>;
  renameWorkspace(title: string): Promise<DesktopState>;
  switchWorkspace(id: string): Promise<DesktopState>;
  updateSession(input: DesktopSessionUpdateInput): Promise<DesktopSessionUpdateResult>;
  promoteNovelty(ids: string[]): Promise<DesktopState>;
  saveCapsuleFromCurrent(): Promise<DesktopState>;
  saveCapsule(capsule: CarryForwardCapsule): Promise<DesktopState>;
  saveWorkflow(input: DesktopWorkflowInput): Promise<DesktopState>;
  applyWorkflow(id: string): Promise<DesktopSessionUpdateResult>;
  generateHandoff(input: { target: ProviderTarget; capsuleId?: string; workflowId?: string; notes?: string }): Promise<ContinuityHandoff>;
  exportWorkspace(): Promise<{ path: string | null; state: DesktopState }>;
  importWorkspace(): Promise<{ path: string | null; state: DesktopState }>;
  copyText(text: string): Promise<void>;
}
