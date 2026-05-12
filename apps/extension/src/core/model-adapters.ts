import type { ModeName } from "@/types/modes";
import type { TargetModel } from "@/types/models";

export function adaptForModel(text: string, targetModel: TargetModel | undefined, mode?: ModeName): string {
  if (!targetModel || targetModel === "generic") {
    return text;
  }

  const modeLine = mode ? `Mode: ${mode.replace("_", " ")}` : "Mode: balanced";

  switch (targetModel) {
    case "chatgpt":
      return `${modeLine}\n\nTask:\n${text}\n\nRespond with a clear structure and practical next steps.`;
    case "claude":
      return `${modeLine}\n\nPlease handle this carefully and preserve the stated constraints.\n\n${text}\n\nUse concise sections and note any assumptions.`;
    case "gemini":
      return `${modeLine}\n\n${text}\n\nKeep the answer direct, structured, and easy to scan.`;
    case "grok":
      return `${modeLine}\n\n${text}\n\nKeep the tone concise and preserve the user's intent.`;
    case "copilot":
      return `${modeLine}\n\nImplementation request:\n${text}\n\nReturn actionable code-oriented steps and tests.`;
  }
}
