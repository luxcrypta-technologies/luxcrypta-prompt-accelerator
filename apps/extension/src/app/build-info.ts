import { EXTENSION_VERSION } from "./constants";

export interface BuildProvenance {
  extension_version: string;
  build_timestamp: string;
  commit_sha: string;
  environment_tag: string;
}

function safeBuildValue(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value.trim() : fallback;
}

export function getBuildProvenance(extensionVersion = EXTENSION_VERSION): BuildProvenance {
  const buildTimestamp =
    typeof __LCPA_BUILD_TIMESTAMP__ === "string" ? __LCPA_BUILD_TIMESTAMP__ : undefined;
  const commitSha = typeof __LCPA_COMMIT_SHA__ === "string" ? __LCPA_COMMIT_SHA__ : undefined;
  const environmentTag =
    typeof __LCPA_ENVIRONMENT_TAG__ === "string" ? __LCPA_ENVIRONMENT_TAG__ : undefined;

  return {
    extension_version: extensionVersion,
    build_timestamp: safeBuildValue(buildTimestamp, "unknown"),
    commit_sha: safeBuildValue(commitSha, "unknown"),
    environment_tag: safeBuildValue(environmentTag, "unknown")
  };
}
