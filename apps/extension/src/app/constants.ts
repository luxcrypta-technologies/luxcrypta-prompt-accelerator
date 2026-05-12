import type { ModeName } from "@/types/modes";
import type { TargetModel } from "@/types/models";

export const PRODUCT_NAME = "LuxCrypta Prompt Accelerator";

export const SUPPORTED_SURFACES = [
  { id: "chatgpt", label: "ChatGPT", hosts: ["chat.openai.com", "chatgpt.com"] },
  { id: "claude", label: "Claude", hosts: ["claude.ai"] },
  { id: "gemini", label: "Gemini", hosts: ["gemini.google.com"] }
] as const;

export const PRIMARY_ACTIONS = [
  { id: "compress", label: "Compress", mode: undefined },
  { id: "focus", label: "Focus", mode: "focus" },
  { id: "continue_session", label: "Continue Session", mode: undefined },
  { id: "save_workflow", label: "Save Workflow", mode: undefined }
] as const;

export const SECONDARY_ACTIONS: Array<{
  id: string;
  label: string;
  mode?: ModeName;
  targetModel?: TargetModel;
}> = [
  { id: "creative", label: "Creative", mode: "creative" },
  { id: "precision", label: "Precision", mode: "precision" },
  { id: "research", label: "Research", mode: "research" },
  { id: "code", label: "Code", mode: "code" },
  { id: "adapt_claude", label: "Adapt for Claude", targetModel: "claude" },
  { id: "adapt_chatgpt", label: "Adapt for ChatGPT", targetModel: "chatgpt" },
  { id: "adapt_gemini", label: "Adapt for Gemini", targetModel: "gemini" },
  { id: "adapt_grok", label: "Adapt for Grok", targetModel: "grok" }
];
