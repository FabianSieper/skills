import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../site.config.ts";
import { actions } from "./actions/index.ts";
import { Engine, type Preview } from "./runtime/engine.ts";
import { buildBrowserBundle } from "./runtime/cli-browser.ts";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function fail(check: string): never {
  throw new Error(check);
}
async function readProjectText(path: string): Promise<string> {
  return readFile(join(project, path), "utf8");
}
async function listTypeScriptFiles(relative: string): Promise<string[]> {
  const dir = join(project, relative);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) fail(`symlink:${relative}/${entry.name}`);
    const path = join(relative, entry.name);
    if (entry.isDirectory()) out.push(...(await listTypeScriptFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}
async function main(): Promise<object> {
  if (!config.configured) fail("config.configured");
  if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(config.browser.cliVersion))
    fail("config.browser.cliVersion");
  if (
    config.browser.session !== config.name ||
    !config.browser.attach.target ||
    !config.allowedOrigins.includes(new URL(config.baseURL).origin) ||
    ![
      config.maxInputBytes,
      config.maxOutputBytes,
      config.maxBundleBytes,
      config.maxCliBytes,
    ].every((value) => Number.isSafeInteger(value) && value > 0)
  )
    fail("config");
  new Engine(join(project, ".local"), config, actions, async () =>
    fail("browser-not-used"),
  );
  const required = [
    "SKILL.md",
    "references/actions.md",
    "references/build-state.json",
    "package-lock.json",
  ];
  for (const path of required)
    if (!(await stat(join(project, path)).catch(() => null))?.isFile())
      fail(`missing:${path}`);
  const docs = await Promise.all(required.slice(0, 3).map(readProjectText));
  if (
    docs.some((value) =>
      /BUILD_REQUIRED|\{\{|<ABSOLUTE_SKILL_DIRECTORY>/.test(value),
    )
  )
    fail("unfinished-placeholder");
  for (const action of actions)
    if (!docs[0]!.includes(action.id) || !docs[1]!.includes(action.id))
      fail(`undocumented:${action.id}`);
  const state = JSON.parse(docs[2]!) as {
    phase?: unknown;
    actions?: Record<
      string,
      {
        mapped?: unknown;
        implemented?: unknown;
        fixture?: unknown;
        live?: unknown;
        remainingRisk?: unknown;
      }
    >;
  };
  if (state.phase !== "HANDOFF" || !state.actions) fail("build-state");
  if (new Set(Object.keys(state.actions)).size !== actions.length)
    fail("build-state-actions");
  for (const action of actions) {
    const value = state.actions[action.id];
    if (
      !value ||
      value.mapped !== true ||
      value.implemented !== true ||
      value.fixture !== "pass" ||
      !["pass", "not-run"].includes(value.live as string) ||
      (value.live === "not-run" &&
        !(
          typeof value.remainingRisk === "string" && value.remainingRisk.trim()
        ))
    )
      fail(`build-state:${action.id}`);
    const preview: Preview = {
      target: { fixture: true },
      version: "fixture",
      changes: { fixture: true },
    };
    await buildBrowserBundle(
      project,
      action,
      action.kind === "read" ? "run" : "prepare",
      action.example,
    );
    if (action.kind === "write")
      await buildBrowserBundle(project, action, "execute", action.example, {
        accountKey: "fixture",
        preview,
      });
  }
  const banned =
    /\.first\s*\(|\.last\s*\(|\.nth\s*\(|force\s*:\s*true|waitForTimeout\s*\(|\.goto\s*\(|chromium\.launch|playwright-cli\s+(?:open|close|close-all|kill-all)/;
  for (const path of await listTypeScriptFiles("src"))
    if (
      !path.endsWith("runtime/guards.ts") &&
      banned.test(await readProjectText(path))
    )
      fail(`banned-pattern:${path}`);
  return { ok: true, actions: actions.map((a) => a.id), status: "ready" };
}
main()
  .then((value) => process.stdout.write(JSON.stringify(value) + "\n"))
  .catch((error) => {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        check: error instanceof Error ? error.message : "validation",
      }) + "\n",
    );
    process.exitCode = 1;
  });
