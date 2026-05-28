/// <reference types="vitest" />
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const appRoot = __dirname;
const repoRoot = resolve(appRoot, "../..");

const packageAliases = [
  { find: /^@luxcrypta\/continuity-types$/, replacement: resolve(repoRoot, "packages/continuity-types/src/index.ts") },
  { find: /^@luxcrypta\/continuity-types\/(.*)$/, replacement: resolve(repoRoot, "packages/continuity-types/src/$1") },
  { find: /^@luxcrypta\/continuity-core$/, replacement: resolve(repoRoot, "packages/continuity-core/src/index.ts") },
  { find: /^@luxcrypta\/continuity-core\/(.*)$/, replacement: resolve(repoRoot, "packages/continuity-core/src/$1") },
  { find: /^@luxcrypta\/continuity-governance$/, replacement: resolve(repoRoot, "packages/continuity-governance/src/index.ts") },
  { find: /^@luxcrypta\/continuity-governance\/(.*)$/, replacement: resolve(repoRoot, "packages/continuity-governance/src/$1") },
  { find: /^@luxcrypta\/continuity-storage$/, replacement: resolve(repoRoot, "packages/continuity-storage/src/index.ts") },
  { find: /^@luxcrypta\/continuity-storage\/(.*)$/, replacement: resolve(repoRoot, "packages/continuity-storage/src/$1") },
  { find: /^@luxcrypta\/continuity-domain$/, replacement: resolve(repoRoot, "packages/continuity-domain/src/index.ts") },
  { find: /^@luxcrypta\/continuity-domain\/(.*)$/, replacement: resolve(repoRoot, "packages/continuity-domain/src/$1") },
  { find: /^@luxcrypta\/continuity-routing$/, replacement: resolve(repoRoot, "packages/continuity-routing/src/index.ts") },
  { find: /^@luxcrypta\/continuity-routing\/(.*)$/, replacement: resolve(repoRoot, "packages/continuity-routing/src/$1") }
];

function readCommitSha(): string {
  if (process.env.LCPA_COMMIT_SHA) return process.env.LCPA_COMMIT_SHA;
  try {
    return execSync("git rev-parse --short=12 HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ mode }) => {
  const target = mode === "firefox" ? "firefox" : "chromium";
  const buildTimestamp = process.env.LCPA_BUILD_TIMESTAMP ?? new Date().toISOString();
  const environmentTag = process.env.LCPA_ENVIRONMENT_TAG ?? target;

  return {
    root: appRoot,
    plugins: [react()],
    publicDir: resolve(appRoot, "public"),
    define: {
      __LCPA_BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
      __LCPA_COMMIT_SHA__: JSON.stringify(readCommitSha()),
      __LCPA_ENVIRONMENT_TAG__: JSON.stringify(environmentTag)
    },
    resolve: {
      alias: [
        { find: "@", replacement: resolve(appRoot, "src") },
        { find: "@platform-runtime", replacement: resolve(appRoot, `src/platform/${target}/api.ts`) },
        ...packageAliases
      ]
    },
    build: {
      outDir: resolve(repoRoot, "dist", target),
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          popup: resolve(appRoot, "popup.html"),
          review: resolve(appRoot, "review.html"),
          options: resolve(appRoot, "options.html")
        },
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name][extname]"
        }
      }
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: [resolve(repoRoot, "tests/**/*.test.ts")],
      setupFiles: [resolve(repoRoot, "tests/setup.ts")],
      alias: [
        { find: "@", replacement: resolve(appRoot, "src") },
        { find: "@platform-runtime", replacement: resolve(appRoot, "src/platform/chromium/api.ts") },
        ...packageAliases
      ]
    }
  };
});
