import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const target = process.argv[2];
if (target !== "chromium" && target !== "firefox") {
  throw new Error("Usage: node scripts/package-extension.mjs <chromium|firefox>");
}

const appRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(appRoot, "../..");
const outDir = resolve(repoRoot, "dist", target);
const packageDir = resolve(repoRoot, "packages");
const zipPath = resolve(packageDir, `luxcrypta-prompt-accelerator-${target}.zip`);

await mkdir(packageDir, { recursive: true });
await rm(zipPath, { force: true });

const result = spawnSync("zip", ["-qr", zipPath, "."], {
  cwd: outDir,
  stdio: "inherit"
});

if (result.status !== 0) {
  throw new Error("zip command failed. Build output remains available in dist.");
}

console.log(`Created ${zipPath}`);
