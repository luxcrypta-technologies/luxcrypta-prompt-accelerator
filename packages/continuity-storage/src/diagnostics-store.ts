import type { DiagnosticSnapshot } from "@luxcrypta/continuity-types/diagnostics";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import { diagnosticKey, STORAGE_PREFIXES } from "./keys";

export class DiagnosticsStore {
  constructor(private readonly storage: ContinuityStorage) {}

  async list(limit = 20): Promise<DiagnosticSnapshot[]> {
    const items = await this.storage.list<DiagnosticSnapshot>(STORAGE_PREFIXES.diagnostic);
    return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, limit);
  }

  save(snapshot: DiagnosticSnapshot): Promise<void> {
    return this.storage.set(diagnosticKey(snapshot.id), snapshot);
  }

  remove(id: string): Promise<void> {
    return this.storage.remove(diagnosticKey(id));
  }
}
