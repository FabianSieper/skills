import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve, relative, isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { config } from "../../site.config.ts";
import { AutomationError } from "./errors.ts";
import type { RegisteredAction, ExecuteGuard } from "./engine.ts";
import type { Input, Json } from "./input.ts";

const execFileAsync = promisify(execFile);
type Phase = "run" | "prepare" | "execute";
type Purpose = "session-list" | "attach" | "runtime";
export interface BrowserResult {
  accountKey: string;
  value: Json;
}
interface Session {
  name: string;
  status: string;
  attached: boolean;
  compatible?: boolean;
  browserType?: string;
}

async function runCli(
  project: string,
  args: string[],
  timeoutMs: number,
  purpose: Purpose,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(config.browser.cliCommand, args, {
      cwd: project,
      timeout: timeoutMs,
      maxBuffer: config.maxCliBytes,
      env: process.env,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (raw) {
    const error = raw as NodeJS.ErrnoException & {
      killed?: boolean;
      signal?: string;
    };
    if (error.code === "ENOENT")
      throw new AutomationError(
        "ATTACH_FAILED",
        "playwright-cli",
        "Command not found.",
      );
    if (
      error.killed ||
      error.signal === "SIGTERM" ||
      error.code === "ETIMEDOUT"
    )
      throw new AutomationError("TIMEOUT", purpose);
    if (purpose === "attach")
      throw new AutomationError(
        "BROWSER_REQUIRED",
        "attach",
        "Open the configured browser and extension/CDP endpoint.",
      );
    throw new AutomationError(
      purpose === "runtime" ? "CLI_PROTOCOL" : "ATTACH_FAILED",
      purpose,
    );
  }
}
export function parseSessions(raw: string): Session[] {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AutomationError("CLI_PROTOCOL", "session-list");
  }
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { browsers?: unknown }).browsers)
  )
    throw new AutomationError("CLI_PROTOCOL", "session-list");
  const sessions = (value as { browsers: unknown[] }).browsers;
  if (
    sessions.some(
      (v) =>
        !v ||
        typeof v !== "object" ||
        typeof (v as { name?: unknown }).name !== "string",
    )
  )
    throw new AutomationError("CLI_PROTOCOL", "session-list");
  return sessions as Session[];
}
async function findConfiguredSession(
  project: string,
): Promise<Session | undefined> {
  const { stdout } = await runCli(
    project,
    ["list", "--json"],
    20_000,
    "session-list",
  );
  return parseSessions(stdout).find((v) => v.name === config.browser.session);
}
function isCompatibleAttachedSession(
  value: Session | undefined,
): value is Session {
  return (
    !!value &&
    value.status === "open" &&
    value.attached === true &&
    value.compatible !== false &&
    (config.browser.attach.mode !== "extension" ||
      value.browserType === config.browser.attach.target)
  );
}
export async function ensureAttached(project: string): Promise<void> {
  const version = (
    await runCli(project, ["--version"], 10_000, "session-list")
  ).stdout.trim();
  if (version !== config.browser.cliVersion)
    throw new AutomationError(
      "CLI_PROTOCOL",
      "playwright-cli-version",
      `Expected ${config.browser.cliVersion}; found ${version}.`,
    );
  const current = await findConfiguredSession(project);
  if (current) {
    if (!isCompatibleAttachedSession(current))
      throw new AutomationError(
        "ATTACH_FAILED",
        "session-mismatch",
        "Remove or rename the incompatible session; never reuse a managed session.",
      );
    return;
  }
  const attach = config.browser.attach;
  const target =
    attach.mode === "extension"
      ? `--extension=${attach.target}`
      : `--cdp=${attach.target}`;
  await runCli(
    project,
    ["attach", target, `--session=${config.browser.session}`],
    30_000,
    "attach",
  );
  const connected = await findConfiguredSession(project);
  if (!isCompatibleAttachedSession(connected))
    throw new AutomationError("ATTACH_FAILED", "session-not-attached");
}
function assertBrowserPayload(raw: unknown): BrowserResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new AutomationError("CLI_PROTOCOL", "run-code-output");
  const object = raw as Record<string, unknown>;
  if (object.ok === false) {
    const error = object.error as Record<string, unknown> | undefined;
    const known = new Set([
      "AUTH_REQUIRED",
      "HUMAN_REQUIRED",
      "UI_DRIFT",
      "AMBIGUOUS_SELECTOR",
      "POSTCONDITION_FAILED",
      "PLAN_CHANGED",
      "TIMEOUT",
      "NOT_CONFIGURED",
    ]);
    const code =
      typeof error?.code === "string" && known.has(error.code)
        ? error.code
        : "INTERNAL";
    throw new AutomationError(
      code as
        | "AUTH_REQUIRED"
        | "HUMAN_REQUIRED"
        | "UI_DRIFT"
        | "AMBIGUOUS_SELECTOR"
        | "POSTCONDITION_FAILED"
        | "PLAN_CHANGED"
        | "TIMEOUT"
        | "NOT_CONFIGURED",
      typeof error?.step === "string" ? error.step : undefined,
      typeof error?.hint === "string" ? error.hint : undefined,
    );
  }
  if (
    object.ok !== true ||
    typeof object.accountKey !== "string" ||
    !object.accountKey
  )
    throw new AutomationError("CLI_PROTOCOL", "run-code-output");
  return { accountKey: object.accountKey, value: object.value as Json };
}
function assertActionPath(project: string, modulePath: string): string {
  const base = resolve(project, "src/actions");
  const path = resolve(modulePath);
  const rel = relative(base, path);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || !rel.endsWith(".ts"))
    throw new AutomationError("NOT_CONFIGURED", "action-module");
  return path;
}
export async function buildBrowserBundle(
  project: string,
  action: RegisteredAction,
  phase: Phase,
  input: Input,
  guard?: ExecuteGuard,
): Promise<string> {
  const actionPath = assertActionPath(project, action.modulePath);
  const sitePagePath = resolve(project, "src/pages/SitePage.ts");
  const browserEntryPath = resolve(project, "src/runtime/browser-entry.ts");
  const source = `
    import { action } from ${JSON.stringify(actionPath)};
    import { SitePage } from ${JSON.stringify(sitePagePath)};
    import { invokeAction } from ${JSON.stringify(browserEntryPath)};
    const options = ${JSON.stringify({ phase, input, guard, allowedOrigins: config.allowedOrigins })};
    export async function invoke(page) {
      return invokeAction(page, action, SitePage, options);
    }
  `;
  let built;
  try {
    built = await build({
      stdin: {
        contents: source,
        resolveDir: project,
        sourcefile: "site-action-entry.ts",
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "iife",
      globalName: "__siteAction",
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
    });
  } catch {
    throw new AutomationError(
      "NOT_CONFIGURED",
      "browser-bundle",
      "Use browser-safe imports only.",
    );
  }
  const bundled = built.outputFiles[0]?.text;
  if (
    !bundled ||
    Buffer.byteLength(bundled) > config.maxBundleBytes ||
    /\bimport\.meta\b|(^|[^\w$])require\s*\(/m.test(bundled)
  )
    throw new AutomationError(
      "NOT_CONFIGURED",
      "browser-bundle",
      "Use browser-safe imports only.",
    );
  return `async page => {
    ${bundled}
    const value = await __siteAction.invoke(page);
    const json = JSON.stringify(value);
    if (new TextEncoder().encode(json).length > ${config.maxOutputBytes})
      return JSON.stringify({ok:false,error:{code:'POSTCONDITION_FAILED',step:'output-size'}});
    return json;
  }`;
}
async function runCodeFile(
  project: string,
  root: string,
  code: string,
  timeoutMs: number,
): Promise<string> {
  const dir = join(root, "run-code");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, `${randomUUID()}.js`);
  await writeFile(path, code, { mode: 0o600, flag: "wx" });
  try {
    return (
      await runCli(
        project,
        [
          `-s=${config.browser.session}`,
          "--raw",
          "run-code",
          `--filename=${path}`,
        ],
        timeoutMs,
        "runtime",
      )
    ).stdout.trim();
  } finally {
    await unlink(path).catch(() => {});
  }
}
export async function invokeBrowser(
  project: string,
  root: string,
  action: RegisteredAction,
  phase: Phase,
  input: Input,
  guard?: ExecuteGuard,
): Promise<BrowserResult> {
  if (!config.configured) throw new AutomationError("NOT_CONFIGURED");
  await ensureAttached(project);
  const wrapper = await buildBrowserBundle(
    project,
    action,
    phase,
    input,
    guard,
  );
  const stdout = await runCodeFile(
    project,
    root,
    wrapper,
    config.actionBudgetMs,
  );
  try {
    return assertBrowserPayload(JSON.parse(stdout));
  } catch (error) {
    if (error instanceof AutomationError) throw error;
    throw new AutomationError("CLI_PROTOCOL", "run-code-output");
  }
}
export async function doctorBrowser(
  project: string,
  root: string,
): Promise<object> {
  await ensureAttached(project);
  const version = config.browser.cliVersion;
  const probe = `async page => JSON.stringify({url:page.url()})`;
  let result: unknown;
  try {
    result = JSON.parse(await runCodeFile(project, root, probe, 15_000));
  } catch {
    throw new AutomationError("CLI_PROTOCOL", "doctor-probe");
  }
  const url = (result as { url?: unknown })?.url;
  if (typeof url !== "string")
    throw new AutomationError("CLI_PROTOCOL", "doctor-probe");
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    throw new AutomationError("UI_DRIFT", "navigation-origin");
  }
  if (!config.allowedOrigins.includes(origin))
    throw new AutomationError(
      "UI_DRIFT",
      "navigation-origin",
      "Select a configured site tab.",
    );
  return {
    session: config.browser.session,
    version,
    origin,
    attached: true,
    browserLaunch: false,
  };
}
