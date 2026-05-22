import { chatgptSurface } from "./chatgpt";
import { claudeSurface } from "./claude";
import { deepseekSurface } from "./deepseek.provider";
import { geminiSurface } from "./gemini";
import { grokSurface } from "./grok";
import { perplexitySurface } from "./perplexity.provider";
import type { ChatSurfaceAdapter } from "./types";

export const CHAT_SURFACES: ChatSurfaceAdapter[] = [
  chatgptSurface,
  claudeSurface,
  geminiSurface,
  grokSurface,
  deepseekSurface,
  perplexitySurface
];

export function findSurface(url: string = window.location.href): ChatSurfaceAdapter | null {
  return CHAT_SURFACES.find((surface) => surface.matches(url)) ?? null;
}
