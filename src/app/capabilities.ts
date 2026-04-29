import { chooseReviewSurface } from "@/platform/review-surface";
import type { ExtensionPlatform, ReviewSurfaceKind } from "@/types/platform";

export function preferredReviewSurface(platform: ExtensionPlatform): ReviewSurfaceKind {
  return chooseReviewSurface(platform.capabilities);
}

export function supportsSurface(surfaceId: string, enabledSurfaceIds: string[]): boolean {
  return enabledSurfaceIds.includes(surfaceId);
}
