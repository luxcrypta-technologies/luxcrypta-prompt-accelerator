import { WorkflowService } from "@/domain/services/workflow-service";
import type { PlatformStorage } from "@/types/platform";
import type { Workflow } from "@/types/workflows";

export function executeSaveWorkflow(
  input: { workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt"> },
  deps: { storage: PlatformStorage }
): Promise<Workflow> {
  return new WorkflowService(deps.storage).save(input.workflow);
}
