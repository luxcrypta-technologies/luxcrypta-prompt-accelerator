import type { DiagnosticSnapshot } from "@/types/diagnostics";
import type { PlatformStorage } from "@/types/platform";
import { diagnosticKey, STORAGE_PREFIXES } from "./keys";

export class DiagnosticsStore {
  constructor(private readonly storage: PlatformStorage) {}

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
