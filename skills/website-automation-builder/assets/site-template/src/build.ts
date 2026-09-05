import { build } from "esbuild";
import { mkdir, writeFile, readdir, unlink } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../site.config.ts";
import { actions } from "./actions/index.ts";
import { Engine } from "./runtime/engine.ts";
import { sha256 } from "./runtime/cli-browser.ts";
import { implementationFingerprint } from "./runtime/fingerprint.ts";
import type { Manifest, Bundle } from "./runtime/manifest.ts";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function compileBrowser(
  source: string,
  directory: string,
  maxBytes: number,
): Promise<string> {
  const built = await build({
    stdin: { contents: source, resolveDir: directory, loader: "ts" },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__siteAction",
    platform: "browser",
    target: "es2022",
    logLevel: "silent",
  });
  const code = built.outputFiles[0]?.text;
  if (
    !code ||
    Buffer.byteLength(code) > maxBytes ||
    /\bimport\.meta\b|(^|[^\w$])require\s*\(/m.test(code)
  )
    throw new Error("browser-safe-bundle");
  return `async (page, request) => {\n${code}\nreturn await __siteAction.invoke(page, request);\n}`;
}
async function main(): Promise<void> {
  new Engine(join(project, ".local"), config, actions, async () => {
    throw new Error("build-never-uses-browser");
  });
  const manifest: Manifest = {
    format: 1,
    buildHash: await implementationFingerprint(project),
    config,
    actions: [],
    observe: {
      ids: [
        "browser.status",
        "browser.inspect",
        "browser.inspectRegion",
        "browser.screenshot",
      ],
      bundle: { file: "", sha256: "" },
    },
  };
  const directory = join(project, "runtime/actions");
  await mkdir(directory, { recursive: true });
  await mkdir(join(project, "scripts"), { recursive: true });
  const serialize = `const json = JSON.stringify(result); return encodeURIComponent(json).replace(/%[0-9A-F]{2}/g, 'x').length <= ${config.maxOutputBytes}
    ? json : JSON.stringify({ok:false,error:{code:'POSTCONDITION_FAILED',step:'output-size'}});`;
  async function artifact(id: string, source: string): Promise<Bundle> {
    const code = await compileBrowser(source, project, config.maxBundleBytes);
    const file = `actions/${id}.js`;
    await writeFile(join(project, "runtime", file), code);
    return { file, sha256: sha256(code) };
  }
  for (const action of actions) {
    const rel = relative(join(project, "src/actions"), action.modulePath);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || !rel.endsWith(".ts"))
      throw new Error("action-module-path");
    const bundle = await artifact(
      action.id,
      `
      import {action} from ${JSON.stringify(action.modulePath)};
      import {SitePage} from './src/pages/SitePage.ts';
      import {invokeAction} from './src/runtime/browser-entry.ts';
      export async function invoke(page, request) {
        page.setDefaultTimeout(${config.timeoutMs});
        const result = await invokeAction(page, action, SitePage, {...request, allowedOrigins: ${JSON.stringify(config.allowedOrigins)}});
        ${serialize}
      }`,
    );
    manifest.actions.push({
      id: action.id,
      kind: action.kind,
      description: action.description,
      input: action.parameters,
      output: { description: action.outputDescription },
      example: action.example,
      preconditions: action.preconditions,
      postconditions: [action.postcondition],
      next: action.next,
      bundle,
    });
  }
  manifest.observe.bundle = await artifact(
    "browser.observe",
    `
    import {SitePage} from './src/pages/SitePage.ts';
    import {observe} from './src/runtime/observation.ts';
    export async function invoke(page, request) {
      page.setDefaultTimeout(${config.timeoutMs});
      const result = await observe(page, new SitePage(page), request, ${JSON.stringify(config.allowedOrigins)});
      ${serialize}
    }`,
  );
  await build({
    entryPoints: [join(project, "src/cli.ts")],
    outfile: join(project, "scripts/site-runtime.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    logLevel: "silent",
  });
  await writeFile(
    join(project, "runtime/manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const keep = new Set([
    ...manifest.actions.map((a) => a.bundle.file),
    manifest.observe.bundle.file,
  ]);
  for (const name of await readdir(directory))
    if (/^[a-zA-Z0-9.-]+\.js$/.test(name) && !keep.has(`actions/${name}`))
      await unlink(join(directory, name));
  console.log(
    JSON.stringify({
      ok: true,
      actions: manifest.actions.length,
      buildHash: manifest.buildHash,
    }),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  });
