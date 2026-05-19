import { HistoryStore } from "@luxcrypta/continuity-storage/history-store";
import type { HistoryAction, HistoryItem } from "@luxcrypta/continuity-types/actions";
import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { TargetModel } from "@luxcrypta/continuity-types/models";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import { createDatedId } from "@luxcrypta/continuity-types/utils/ids";
import { nowIso } from "@luxcrypta/continuity-types/utils/time";

export class HistoryService {
  private readonly store: HistoryStore;

  constructor(storage: ContinuityStorage) {
    this.store = new HistoryStore(storage);
  }

  list(limit?: number): Promise<HistoryItem[]> {
    return this.store.list(limit);
  }

  async record(input: {
    action: HistoryAction;
    originalText: string;
    transformedText?: string;
    mode?: ModeName;
    targetModel?: TargetModel;
  }): Promise<HistoryItem> {
    const timestamp = nowIso();
    const item: HistoryItem = {
      ...input,
      id: createDatedId("history", `${input.action}:${input.originalText}`, timestamp),
      createdAt: timestamp
    };
    await this.store.save(item);
    return item;
  }
}
