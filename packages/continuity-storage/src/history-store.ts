import type { HistoryItem } from "@luxcrypta/continuity-types/actions";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import { historyKey, STORAGE_PREFIXES } from "./keys";

export class HistoryStore {
  constructor(private readonly storage: ContinuityStorage) {}

  async list(limit = 50): Promise<HistoryItem[]> {
    const items = await this.storage.list<HistoryItem>(STORAGE_PREFIXES.history);
    return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, limit);
  }

  save(item: HistoryItem): Promise<void> {
    return this.storage.set(historyKey(item.id), item);
  }

  remove(id: string): Promise<void> {
    return this.storage.remove(historyKey(id));
  }
}
