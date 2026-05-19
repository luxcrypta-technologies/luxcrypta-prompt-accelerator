import { WorkflowService } from "@luxcrypta/continuity-domain/services/workflow-service";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { Workflow } from "@luxcrypta/continuity-types/workflows";

export function executeSaveWorkflow(
  input: { workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt"> },
  deps: { storage: ContinuityStorage }
): Promise<Workflow> {
  return new WorkflowService(deps.storage).save(input.workflow);
}
