import type { ModeName } from "./modes";
import type { TargetModel } from "./models";

export type HistoryAction =
  | "compress"
  | "focus"
  | "continue_session"
  | "creative"
  | "precision"
  | "research"
  | "code"
  | "adapt_model"
  | "save_workflow";

export interface HistoryItem {
  id: string;
  action: HistoryAction;
  originalText: string;
  transformedText?: string;
  mode?: ModeName;
  targetModel?: TargetModel;
  createdAt: string;
}
