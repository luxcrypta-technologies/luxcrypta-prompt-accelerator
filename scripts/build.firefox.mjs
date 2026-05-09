import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "dist/firefox");

function aliasPlugin(target) {
  function resolveSourcePath(path) {
    const base = resolve(root, "src", path);
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
        path: resolve(root, `src/platform/${target}/api.ts`)
      }));
      buildContext.onResolve({ filter: /^@\// }, (args) => ({
        path: resolveSourcePath(args.path.slice(2))
      }));
    }
  };
}

async function copyManifest() {
  const manifest = await readFile(resolve(root, "manifests/manifest.firefox.json"), "utf8");
  await writeFile(resolve(outDir, "manifest.json"), manifest);
}

async function copyContentCss() {
  await mkdir(resolve(outDir, "assets"), { recursive: true });
  await cp(resolve(root, "src/content/content.css"), resolve(outDir, "assets/content.css"));
}

async function removeReactDomInnerHtmlFallback() {
  const assetsDir = resolve(outDir, "assets");
  const files = await readdir(assetsDir);
  let patched = 0;

  for (const file of files) {
    if (!file.endsWith(".js")) continue;

    const filePath = resolve(assetsDir, file);
    let code = await readFile(filePath, "utf8");
    if (!code.includes("innerHTML")) continue;

    const before = code;
    code = code.replace(
      /var ([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)=function\(e\)\{return typeof MSApp<`u`&&MSApp\.execUnsafeLocalFunction\?function\(t,n,r,i\)\{MSApp\.execUnsafeLocalFunction\(function\(\)\{return e\(t,n,r,i\)\}\)\}:e\}\(function\(e,t\)\{if\(e\.namespaceURI!==`http:\/\/www\.w3\.org\/2000\/svg`\|\|`innerHTML`in e\)e\.innerHTML=t;else\{for\(\1\|\|=document\.createElement\(`div`\),\1\.innerHTML=`<svg>`\+t\.valueOf\(\)\.toString\(\)\+`<\/svg>`,t=\1\.firstChild;e\.firstChild;\)e\.removeChild\(e\.firstChild\);for\(;t\.firstChild;\)e\.appendChild\(t\.firstChild\)\}\}\);/,
      "var $1,$2=function(e){return typeof MSApp<`u`&&MSApp.execUnsafeLocalFunction?function(t,n,r,i){MSApp.execUnsafeLocalFunction(function(){return e(t,n,r,i)})}:e}(function(e,t){e.textContent=t==null?``:String(t)});"
    );

    if (code !== before) {
      patched += 1;
      await writeFile(filePath, code);
    }
  }

  if (patched === 0) {
    throw new Error("Expected to patch ReactDOM innerHTML fallback for Firefox AMO lint, but no bundle matched.");
  }
}

await mkdir(outDir, { recursive: true });
await copyManifest();
await copyContentCss();

await build({
  entryPoints: [resolve(root, "src/background/service-worker.ts")],
  bundle: true,
  outfile: resolve(outDir, "assets/service-worker.js"),
  format: "iife",
  platform: "browser",
  sourcemap: false,
  plugins: [aliasPlugin("firefox")]
});

await removeReactDomInnerHtmlFallback();

await build({
  entryPoints: [resolve(root, "src/content/content-script.ts")],
  bundle: true,
  outfile: resolve(outDir, "assets/content-script.js"),
  format: "iife",
  platform: "browser",
  sourcemap: false,
  plugins: [aliasPlugin("firefox")]
});
