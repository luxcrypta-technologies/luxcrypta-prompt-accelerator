import type { CarryForwardCapsule } from "./capsules";
import type { DiagnosticSnapshot } from "./diagnostics";
import type { SessionGovernanceState } from "./governance";
import type { UserPreferences } from "./preferences";
import type { Workflow } from "./workflows";

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  workflows: Workflow[];
  capsules: CarryForwardCapsule[];
  preferences?: UserPreferences;
  sessions?: SessionGovernanceState[];
  diagnostics?: DiagnosticSnapshot[];
}

export interface ImportBundleResult {
  workflowsImported: number;
  capsulesImported: number;
  preferencesImported: boolean;
  sessionsImported?: number;
  diagnosticsImported?: number;
}
