import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { Workflow } from "@luxcrypta/continuity-types/workflows";
import { workflowKey, STORAGE_PREFIXES } from "./keys";

export class WorkflowStore {
  constructor(private readonly storage: ContinuityStorage) {}

  get(id: string): Promise<Workflow | null> {
    return this.storage.get<Workflow>(workflowKey(id));
  }

  async list(): Promise<Workflow[]> {
    const items = await this.storage.list<Workflow>(STORAGE_PREFIXES.workflow);
    return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  save(workflow: Workflow): Promise<void> {
    return this.storage.set(workflowKey(workflow.id), workflow);
  }

  remove(id: string): Promise<void> {
    return this.storage.remove(workflowKey(id));
  }
}
