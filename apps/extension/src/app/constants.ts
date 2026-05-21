export const PRODUCT_NAME = "LuxCrypta Prompt Accelerator";
export const EXTENSION_VERSION = "2.2.2";
export const RUNTIME_LABEL = "Powered by LuxCrypta";
export const ADVANCED_ACTION = { id: "advanced_review", label: "Advanced" } as const;

export const SUPPORTED_SURFACES = [
  { id: "chatgpt", label: "ChatGPT", hosts: ["chat.openai.com", "chatgpt.com"] },
  { id: "claude", label: "Claude", hosts: ["claude.ai"] },
  { id: "gemini", label: "Gemini", hosts: ["gemini.google.com"] },
  { id: "grok", label: "Grok", hosts: ["grok.com"] }
] as const;

export const PRIMARY_ACTIONS = [ADVANCED_ACTION] as const;
export const SECONDARY_ACTIONS = [] as const;
