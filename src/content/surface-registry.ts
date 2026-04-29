import { findSurface } from "@/surfaces";
import type { ChatSurfaceAdapter } from "@/surfaces/types";

export function getCurrentSurface(): ChatSurfaceAdapter | null {
  return findSurface(window.location.href);
}
