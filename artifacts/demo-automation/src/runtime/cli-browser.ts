import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { AutomationError, type ErrorCode } from "./errors.ts";
import type { Manifest, Bundle, RuntimeSettings } from "./manifest.ts";
import type { BrowserInvocation, ExecuteGuard } from "./engine.ts";
import type { Input } from "./input.ts";

const exec = promisify(execFile);
interface Session {
  name: string;
  status: string;
  attached: boolean;
  compatible?: boolean;
  browserType?: string;
}
export function parseSessions(raw: string): Session[] {
  try {
    const value = JSON.parse(raw);
    if (
      !Array.isArray(value.browsers) ||
      value.browsers.some((v: Session) => !v || typeof v.name !== "string")
    )
      throw new Error();
    return value.browsers;
  } catch {
    throw new AutomationError("CLI_PROTOCOL", "session-list");
  }
}
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function hasRunningBrowser(
  output: string,
  target: string,
  platform = process.platform,
): boolean {
  const names: Record<string, string[]> = {
    chrome: [
      "Google Chrome",
      "google-chrome",
      "google-chrome-stable",
      "chrome",
      "chrome.exe",
    ],
    "chrome-beta": ["Google Chrome Beta", "google-chrome-beta"],
    "chrome-dev": ["Google Chrome Dev", "google-chrome-unstable"],
    "chrome-canary": ["Google Chrome Canary"],
    msedge: ["Microsoft Edge", "microsoft-edge", "msedge", "msedge.exe"],
  };
  const allowed = names[target];
  if (!allowed) return false;
  return output.split(/\r?\n/).some((line) => {
    const name =
      platform === "win32"
        ? line.match(/^"([^"]+)"/)?.[1]
        : line.trim().split("/").pop();
    return !!name && allowed.includes(name);
  });
}
async function requireRunningBrowser(target: string): Promise<void> {
  let output: string;
  try {
    output = (
      await exec(
        process.platform === "win32" ? "tasklist" : "ps",
        process.platform === "win32"
          ? ["/FO", "CSV", "/NH"]
          : ["-A", "-o", "comm="],
        { timeout: 5000, maxBuffer: 2_097_152 },
      )
    ).stdout;
  } catch {
    throw new AutomationError("ATTACH_FAILED", "browser-presence-check");
  }
  if (!hasRunningBrowser(output, target))
    throw new AutomationError("BROWSER_REQUIRED", "browser-presence-check");
}

// The ONLY runtime browser transport. No shell, browser driver or runtime compiler.
export class CliBrowser {
  readonly project: string;
  readonly root: string;
  readonly config: RuntimeSettings;
  constructor(project: string, root: string, config: RuntimeSettings) {
    this.project = project;
    this.root = root;
    this.config = config;
  }
  private async cli(
    args: string[],
    purpose: "list" | "attach" | "runtime",
  ): Promise<string> {
    try {
      const script = this.config.browser.cliScript;
      const result = await exec(
        script ? process.execPath : this.config.browser.cliCommand,
        script ? [script, ...args] : args,
        {
          cwd: this.project,
          timeout: purpose === "runtime" ? this.config.actionBudgetMs : 30_000,
          maxBuffer: this.config.maxCliBytes,
          env: process.env,
        },
      );
      return result.stdout.trim();
    } catch (raw) {
      const error = raw as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
      };
      const text = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
      const missing =
        /browser.*(?:not running|not open)|no running browser|no browser.*running/i.test(
          text,
        );
      throw new AutomationError(
        purpose === "attach"
          ? missing
            ? "BROWSER_REQUIRED"
            : "ATTACH_FAILED"
          : purpose === "runtime"
            ? "CLI_PROTOCOL"
            : "ATTACH_FAILED",
        purpose,
      );
    }
  }
  async ensureAttached(): Promise<void> {
    if (
      (await this.cli(["--version"], "list")) !== this.config.browser.cliVersion
    )
      throw new AutomationError("CLI_PROTOCOL", "playwright-cli-version");
    const find = async () =>
      parseSessions(await this.cli(["list", "--json"], "list")).find(
        (v) => v.name === this.config.browser.session,
      );
    const compatible = (v: Session | undefined) =>
      !!v &&
      v.status === "open" &&
      v.attached === true &&
      v.compatible === true &&
      (this.config.browser.attach.mode !== "extension" ||
        v.browserType === this.config.browser.attach.target);
    const current = await find();
    if (current) {
      if (!compatible(current))
        throw new AutomationError("ATTACH_FAILED", "session-mismatch");
      return;
    }
    const { mode, target } = this.config.browser.attach;
    if (!["extension", "cdp"].includes(mode))
      throw new AutomationError("ATTACH_FAILED", "attach-config");
    // CLI extension attach opens its connection URL through the browser executable.
    // Refuse before invoking it if the user's browser is absent. CDP never launches.
    if (mode === "extension") await requireRunningBrowser(target);
    await this.cli(
      [
        "attach",
        `--${mode}=${target}`,
        `--session=${this.config.browser.session}`,
      ],
      "attach",
    );
    if (!compatible(await find()))
      throw new AutomationError("ATTACH_FAILED", "session-not-attached");
  }
  async invoke(bundle: Bundle, request: object): Promise<BrowserInvocation> {
    if (!/^actions\/[a-zA-Z0-9.-]+\.js$/.test(bundle.file))
      throw new AutomationError("BUILD_REQUIRED", "bundle-path");
    let code: string;
    try {
      code = await readFile(join(this.project, "runtime", bundle.file), "utf8");
    } catch {
      throw new AutomationError("BUILD_REQUIRED", "bundle-missing");
    }
    if (
      sha256(code) !== bundle.sha256 ||
      Buffer.byteLength(code) > this.config.maxBundleBytes
    )
      throw new AutomationError("BUILD_REQUIRED", "bundle-integrity");
    await this.ensureAttached();
    const directory = join(this.root, "run-code");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, `${randomUUID()}.js`);
    // Serialization only: the prebuilt function owns all behavior.
    await writeFile(
      path,
      `async page => { const invoke = ${code}; return await invoke(page, ${JSON.stringify(request)}); }`,
      { flag: "wx", mode: 0o600 },
    );
    try {
      const stdout = await this.cli(
        [
          `-s=${this.config.browser.session}`,
          "--raw",
          "run-code",
          `--filename=${path}`,
        ],
        "runtime",
      );
      let value;
      try {
        value = JSON.parse(stdout);
        // CLI 0.1.19 --raw serializes a returned string once more.
        if (typeof value === "string") value = JSON.parse(value);
      } catch {
        throw new AutomationError("CLI_PROTOCOL", "run-code-output");
      }
      if (value?.ok === false) {
        const known: ErrorCode[] = [
          "AUTH_REQUIRED",
          "HUMAN_REQUIRED",
          "UI_DRIFT",
          "AMBIGUOUS_SELECTOR",
          "UNSUPPORTED_UI_STATE",
          "UNKNOWN_REGION",
          "POSTCONDITION_FAILED",
          "PLAN_CHANGED",
          "PLAN_EXPIRED",
          "TIMEOUT",
          "NOT_CONFIGURED",
        ];
        throw new AutomationError(
          known.includes(value.error?.code) ? value.error.code : "INTERNAL",
          value.error?.step,
        );
      }
      if (
        value?.ok !== true ||
        typeof value.accountKey !== "string" ||
        !value.accountKey ||
        Buffer.byteLength(JSON.stringify(value)) > this.config.maxOutputBytes
      )
        throw new AutomationError("CLI_PROTOCOL", "run-code-output");
      return value;
    } finally {
      await unlink(path).catch(() => {});
    }
  }
  async domain(
    manifest: Manifest,
    id: string,
    phase: "run" | "prepare" | "execute",
    input: Input,
    guard?: ExecuteGuard,
  ): Promise<BrowserInvocation> {
    if (!this.config.configured) throw new AutomationError("NOT_CONFIGURED");
    const action = manifest.actions.find((a) => a.id === id);
    if (!action) throw new AutomationError("UNKNOWN_ACTION");
    return this.invoke(action.bundle, { phase, input, guard });
  }
}
