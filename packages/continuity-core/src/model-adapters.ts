import type { ModeName } from "@luxcrypta/continuity-types/modes";
import type { TargetModel } from "@luxcrypta/continuity-types/models";

export function adaptForModel(text: string, targetModel: TargetModel | undefined, mode?: ModeName): string {
  if (!targetModel || targetModel === "generic") {
    return text;
  }

  void mode;
  const runtimeLine = "Continuity runtime: always on";

  switch (targetModel) {
    case "chatgpt":
      return `${runtimeLine}\n\nTask:\n${text}\n\nRespond with a clear structure and practical next steps.`;
    case "claude":
      return `${runtimeLine}\n\nPlease handle this carefully and preserve the stated constraints.\n\n${text}\n\nUse concise sections and note any assumptions.`;
    case "gemini":
      return `${runtimeLine}\n\n${text}\n\nKeep the answer direct, structured, and easy to scan.`;
    case "grok":
      return `${runtimeLine}\n\n${text}\n\nKeep the tone concise and preserve the user's intent.`;
    case "copilot":
      return `${runtimeLine}\n\nImplementation request:\n${text}\n\nReturn actionable code-oriented steps and tests.`;
  }
}
