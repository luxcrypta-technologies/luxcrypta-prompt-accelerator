import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const appRoot = resolve(import.meta.dirname, "..");
const root = resolve(appRoot, "../..");
const packageDir = resolve(root, "packages");
const zipPath = resolve(packageDir, "luxcrypta-prompt-accelerator-source.zip");

await mkdir(packageDir, { recursive: true });
await rm(zipPath, { force: true });

const excludePatterns = [
  ".git/*",
  ".DS_Store",
  ".env",
  ".env.*",
  "node_modules/*",
  "*/node_modules/*",
  "apps/desktop/build/*",
  "dist/*",
  "output/*",
  "release/*",
  "packages/*.zip",
  "coverage/*",
  ".cache/*",
  ".vite/*"
];

const args = ["-qr", zipPath, ".", ...excludePatterns.flatMap((pattern) => ["-x", pattern])];
const result = spawnSync("zip", args, {
  cwd: root,
  stdio: "inherit"
});

if (result.status !== 0) {
  throw new Error("source package zip command failed.");
}

console.log(`Created ${zipPath}`);
