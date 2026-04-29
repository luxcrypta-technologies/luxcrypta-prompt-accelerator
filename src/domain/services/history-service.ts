import { HistoryStore } from "@/storage/history-store";
import type { HistoryAction, HistoryItem } from "@/types/actions";
import type { ModeName } from "@/types/modes";
import type { TargetModel } from "@/types/models";
import type { PlatformStorage } from "@/types/platform";
import { createDatedId } from "@/utils/ids";
import { nowIso } from "@/utils/time";

export class HistoryService {
  private readonly store: HistoryStore;

  constructor(storage: PlatformStorage) {
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
