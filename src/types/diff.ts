export type DiffOperation = "equal" | "insert" | "delete" | "replace";

export interface DiffBlock {
  id: string;
  operation: DiffOperation;
  originalText: string;
  transformedText: string;
  reason?: string;
}
