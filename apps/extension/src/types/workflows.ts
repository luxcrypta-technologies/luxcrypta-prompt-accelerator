import type { ModeName } from "./modes";
import type { TargetModel } from "./models";

export interface Workflow {
  id: string;
  title: string;
  objective: string;
  mode: ModeName;
  constraints: string[];
  outputPreferences: string[];
  carryForwardContext?: string;
  targetModel?: TargetModel;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}
