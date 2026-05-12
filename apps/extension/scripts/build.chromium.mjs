import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

const appRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(appRoot, "../..");
const outDir = resolve(repoRoot, "dist/chromium");

function aliasPlugin(target) {
  function resolveSourcePath(path) {
    const base = resolve(appRoot, "src", path);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return base;
  }

  return {
    name: "local-alias",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^@platform-runtime$/ }, () => ({
        path: resolve(appRoot, `src/platform/${target}/api.ts`)
      }));
      buildContext.onResolve({ filter: /^@\// }, (args) => ({
        path: resolveSourcePath(args.path.slice(2))
      }));
    }
  };
}

async function copyManifest() {
  const manifest = await readFile(resolve(appRoot, "manifests/manifest.chromium.json"), "utf8");
  await writeFile(resolve(outDir, "manifest.json"), manifest);
}

async function copyContentCss() {
  await mkdir(resolve(outDir, "assets"), { recursive: true });
  await cp(resolve(appRoot, "src/content/content.css"), resolve(outDir, "assets/content.css"));
}

await mkdir(outDir, { recursive: true });
await copyManifest();
await copyContentCss();

await build({
  entryPoints: [resolve(appRoot, "src/background/service-worker.ts")],
  bundle: true,
  outfile: resolve(outDir, "assets/service-worker.js"),
  format: "esm",
  platform: "browser",
  sourcemap: false,
  plugins: [aliasPlugin("chromium")]
});

await build({
  entryPoints: [resolve(appRoot, "src/content/content-script.ts")],
  bundle: true,
  outfile: resolve(outDir, "assets/content-script.js"),
  format: "iife",
  platform: "browser",
  sourcemap: false,
  plugins: [aliasPlugin("chromium")]
});
