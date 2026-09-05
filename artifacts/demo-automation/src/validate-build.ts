import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../site.config.ts";
import { actions } from "./actions/index.ts";
import { Engine } from "./runtime/engine.ts";
import { sha256 } from "./runtime/cli-browser.ts";
import { implementationFingerprint } from "./runtime/fingerprint.ts";
import type { Manifest } from "./runtime/manifest.ts";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function fail(check: string): never {
  throw new Error(check);
}
async function text(path: string): Promise<string> {
  return readFile(join(project, path), "utf8");
}
async function walk(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(join(project, dir), {
    withFileTypes: true,
  })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) fail(`symlink:${path}`);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}
async function main(): Promise<object> {
  if (!config.configured) fail("config.configured");
  if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(config.browser.cliVersion))
    fail("config.browser.cliVersion");
  if (
    config.browser.session !== config.name ||
    !config.browser.attach.target ||
    !["extension", "cdp"].includes(config.browser.attach.mode) ||
    !config.allowedOrigins.includes(new URL(config.baseURL).origin) ||
    ![
      config.timeoutMs,
      config.actionBudgetMs,
      config.planTtlMs,
      config.maxInputBytes,
      config.maxOutputBytes,
      config.maxBundleBytes,
      config.maxCliBytes,
    ].every((v) => Number.isSafeInteger(v) && v > 0)
  )
    fail("config");
  new Engine(join(project, ".local"), config, actions, async () =>
    fail("no-browser-in-validator"),
  );
  for (const file of [
    "SKILL.md",
    "references/actions.md",
    "references/flows.md",
    "references/selectors.md",
    "references/verification.md",
    "references/build-state.json",
    "package-lock.json",
    "scripts/site-runtime.mjs",
    "runtime/manifest.json",
  ])
    if (!(await stat(join(project, file)).catch(() => null))?.isFile())
      fail(`missing:${file}`);
  const docs = await Promise.all(
    [
      "SKILL.md",
      "references/actions.md",
      "references/flows.md",
      "references/selectors.md",
      "references/verification.md",
      "references/build-state.json",
    ].map(text),
  );
  if (docs.some((v) => /BUILD_REQUIRED|\{\{/.test(v)))
    fail("unfinished-placeholder");
  const state = JSON.parse(docs[5]!);
  if (
    state.phase !== "HANDOFF" ||
    !state.actions ||
    Object.keys(state.actions).length !== actions.length
  )
    fail("build-state");
  for (const action of actions) {
    if (!docs[1]!.includes(action.id)) fail(`undocumented:${action.id}`);
    const evidence = state.actions[action.id];
    if (
      !evidence ||
      evidence.mapped !== true ||
      evidence.implemented !== true ||
      evidence.fixture !== "pass" ||
      !["pass", "not-run"].includes(evidence.live) ||
      (evidence.live === "not-run" && !evidence.remainingRisk?.trim())
    )
      fail(`build-state:${action.id}`);
  }
  const manifest: Manifest = JSON.parse(await text("runtime/manifest.json"));
  if (manifest.buildHash !== (await implementationFingerprint(project)))
    fail("stale-build");
  if (
    JSON.stringify(manifest.actions.map((a) => a.id)) !==
    JSON.stringify(actions.map((a) => a.id))
  )
    fail("manifest-registry");
  for (const bundle of [
    ...manifest.actions.map((a) => a.bundle),
    manifest.observe.bundle,
  ]) {
    const code = await text(`runtime/${bundle.file}`);
    if (
      sha256(code) !== bundle.sha256 ||
      !code.startsWith("async (page, request) =>")
    )
      fail("bundle-integrity");
  }
  const runtime = await text("scripts/site-runtime.mjs");
  if (
    /from ["'](?!node:)|import\(["'](?!node:)|\besbuild\b|experimental-strip-types|chromium\.launch|connectOverCDP/.test(
      runtime,
    )
  )
    fail("runtime-portability");
  const banned =
    /\.(?:first|last|nth)\s*\(|force\s*:\s*true|waitForTimeout\s*\(|xpath=|\.mouse\.|\.launch(?:PersistentContext)?\s*\(|connectOverCDP\s*\(/;
  for (const file of await walk("src")) {
    if (!file.endsWith(".ts") || file === "src/validate-build.ts") continue;
    const source = await text(file);
    if (banned.test(source)) fail(`banned-pattern:${file}`);
    if (
      /src\/(?:pages|components|actions)\//.test(file) &&
      /\.goto\s*\(/.test(source)
    )
      fail(`use-navigation-guard:${file}`);
  }
  return {
    ok: true,
    status: "ready",
    actions: actions.map((a) => a.id),
    live: Object.values(state.actions).every((a: any) => a.live === "pass")
      ? "pass"
      : "limited-see-evidence",
  };
}
main()
  .then((v) => console.log(JSON.stringify(v)))
  .catch((e) => {
    console.log(JSON.stringify({ ok: false, check: e.message }));
    process.exitCode = 1;
  });
