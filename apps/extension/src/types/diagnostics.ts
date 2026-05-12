import type { SessionDiagnostics } from "./governance";

export interface DiagnosticSnapshot {
  id: string;
  sessionId: string;
  diagnostics: SessionDiagnostics;
  createdAt: string;
}
