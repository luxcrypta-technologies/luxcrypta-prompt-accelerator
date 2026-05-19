import { WorkflowStore } from "@luxcrypta/continuity-storage/workflow-store";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { Workflow } from "@luxcrypta/continuity-types/workflows";
import { createDatedId } from "@luxcrypta/continuity-types/utils/ids";
import { nowIso } from "@luxcrypta/continuity-types/utils/time";

export class WorkflowService {
  private readonly store: WorkflowStore;

  constructor(storage: ContinuityStorage) {
    this.store = new WorkflowStore(storage);
  }

  list(): Promise<Workflow[]> {
    return this.store.list();
  }

  async save(input: Omit<Workflow, "id" | "createdAt" | "updatedAt">): Promise<Workflow> {
    const timestamp = nowIso();
    const workflow: Workflow = {
      ...input,
      id: createDatedId("workflow", `${input.title}:${input.objective}`, timestamp),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.save(workflow);
    return workflow;
  }

  async upsert(workflow: Workflow): Promise<Workflow> {
    const updated = { ...workflow, updatedAt: nowIso() };
    await this.store.save(updated);
    return updated;
  }
}
