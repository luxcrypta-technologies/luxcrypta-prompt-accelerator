import { chatgptSurface } from "./chatgpt";
import { claudeSurface } from "./claude";
import { geminiSurface } from "./gemini";
import type { ChatSurfaceAdapter } from "./types";

export const CHAT_SURFACES: ChatSurfaceAdapter[] = [chatgptSurface, claudeSurface, geminiSurface];

export function findSurface(url: string = window.location.href): ChatSurfaceAdapter | null {
  return CHAT_SURFACES.find((surface) => surface.matches(url)) ?? null;
}
