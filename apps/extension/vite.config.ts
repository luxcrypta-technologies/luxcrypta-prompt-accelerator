/// <reference types="vitest" />
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

export default defineConfig(({ mode }) => {
  const target = mode === "firefox" ? "firefox" : "chromium";

  return {
    root: appRoot,
    plugins: [react()],
    publicDir: resolve(appRoot, "public"),
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
