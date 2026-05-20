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
    const id = createDatedId("workflow", `${input.title}:${input.objective}`, timestamp);
    const workflow: Workflow = {
      version: 1,
      ...input,
      id,
      workflow_id: id,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.save(workflow);
    const persisted = await this.store.get(workflow.id);
    if (!persisted) {
      throw new Error("Workflow storage write could not be verified.");
    }
    return persisted;
  }

  async upsert(workflow: Workflow): Promise<Workflow> {
    const updated = {
      ...workflow,
      version: workflow.version ?? 1,
      workflow_id: workflow.workflow_id ?? workflow.id,
      updatedAt: nowIso()
    } satisfies Workflow;
    await this.store.save(updated);
    const persisted = await this.store.get(updated.id);
    if (!persisted) {
      throw new Error("Workflow storage write could not be verified.");
    }
    return persisted;
  }
}
