import type { DiffBlock } from "@/types/diff";
import { createStableId } from "@/utils/ids";

function lines(text: string): string[] {
  return text.split("\n");
}

export function buildDiff(originalText: string, transformedText: string): DiffBlock[] {
  if (originalText === transformedText) {
    return [
      {
        id: createStableId("diff", originalText),
        operation: "equal",
        originalText,
        transformedText,
        reason: "No text changes were needed."
      }
    ];
  }

  const originalLines = lines(originalText);
  const transformedLines = lines(transformedText);
  const count = Math.max(originalLines.length, transformedLines.length);
  const blocks: DiffBlock[] = [];

  for (let index = 0; index < count; index += 1) {
    const original = originalLines[index] ?? "";
    const transformed = transformedLines[index] ?? "";
    if (original === transformed) {
      blocks.push({
        id: createStableId("diff", `equal:${index}:${original}`),
        operation: "equal",
        originalText: original,
        transformedText: transformed
      });
    } else if (!original) {
      blocks.push({
        id: createStableId("diff", `insert:${index}:${transformed}`),
        operation: "insert",
        originalText: "",
        transformedText: transformed,
        reason: "Added structure or preserved requirement."
      });
    } else if (!transformed) {
      blocks.push({
        id: createStableId("diff", `delete:${index}:${original}`),
        operation: "delete",
        originalText: original,
        transformedText: "",
        reason: "Removed low-information or duplicate wording."
      });
    } else {
      blocks.push({
        id: createStableId("diff", `replace:${index}:${original}:${transformed}`),
        operation: "replace",
        originalText: original,
        transformedText: transformed,
        reason: "Reframed for clarity, mode, or target formatting."
      });
    }
  }

  return blocks;
}
