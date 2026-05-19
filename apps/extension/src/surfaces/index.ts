import { chatgptSurface } from "./chatgpt";
import { claudeSurface } from "./claude";
import { geminiSurface } from "./gemini";
import { grokSurface } from "./grok";
import type { ChatSurfaceAdapter } from "./types";

export const CHAT_SURFACES: ChatSurfaceAdapter[] = [chatgptSurface, claudeSurface, geminiSurface, grokSurface];

export function findSurface(url: string = window.location.href): ChatSurfaceAdapter | null {
  return CHAT_SURFACES.find((surface) => surface.matches(url)) ?? null;
}
