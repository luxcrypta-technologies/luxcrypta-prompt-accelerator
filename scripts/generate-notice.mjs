import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const dependencies = Object.keys(pkg.dependencies ?? {}).sort();

const notice = `LuxCrypta Prompt Accelerator

This product is a public browser-extension utility. It does not contain private product internals.

Runtime dependencies:
${dependencies.map((dependency) => `- ${dependency}`).join("\n")}
`;

await writeFile(resolve(root, "NOTICE"), notice);
