import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = resolve(__dirname, "../..");

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

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: packageAliases
  },
  build: {
    outDir: resolve(repoRoot, "dist/desktop/renderer"),
    emptyOutDir: true
  }
});
