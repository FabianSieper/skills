// src/cli.ts
import { parseArgs } from "node:util";
import { readFile as readFile3, stat as stat2, mkdir as mkdir3 } from "node:fs/promises";
import { dirname, resolve, join as join3 } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID as randomUUID3 } from "node:crypto";

// src/runtime/engine.ts
import {
  mkdir,
  open,
  readFile,
  stat,
  writeFile,
  rename,
  unlink,
  readdir
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// src/runtime/errors.ts
var messages = {
  UNSUPPORTED_UI_STATE: "Observe the current state; use a known recovery action or return to Builder/Repair mode.",
  UNKNOWN_REGION: "Use a registered region ID; diagnostic inspect can explain an unknown page.",
  BUILD_REQUIRED: "Precompiled runtime is missing, stale or damaged. Rebuild in Builder mode.",
  INVALID_INPUT: "Invalid input. Read the action contract; check required fields, types and limits.",
  UNKNOWN_ACTION: "Unknown or unsupported action. Use list/describe; do not improvise.",
  AUTH_REQUIRED: "The already-open browser is not authenticated as the required account. Let the user log in there, then retry.",
  HUMAN_REQUIRED: "Manual user interaction is required in the already-open browser. Do not bypass this state.",
  BROWSER_REQUIRED: "The configured browser must already be open. Do not launch a replacement browser.",
  ATTACH_FAILED: "Could not attach playwright-cli to the configured open browser/session. Check the browser, extension/CDP setup and session.",
  CLI_PROTOCOL: "playwright-cli returned an unexpected result. Stop instead of guessing or falling back to raw browser commands.",
  UI_DRIFT: "The observed UI no longer matches the documented flow. Stop and repair the POM.",
  AMBIGUOUS_SELECTOR: "The target locator matches more than one element. Stop; do not pick the first.",
  POSTCONDITION_FAILED: "The action result or expected business state could not be verified.",
  PLAN_CHANGED: "Account, target, state, input or implementation changed. Review a new plan.",
  PLAN_EXPIRED: "The plan expired. Create and review a new plan.",
  APPROVAL_REQUIRED: "The exact stored plan and its approval hash are required.",
  PLAN_USED: "This plan has already been attempted. Check the business state before doing anything else.",
  UNKNOWN_COMMIT: "A write may have happened. Do not retry; verify the business state with a read action.",
  BUSY: "This project already has a runtime lock. Check the running process; do not blindly remove it.",
  TIMEOUT: "The bounded operation timed out. Inspect the state; do not blindly retry writes.",
  INTERNAL: "The operation failed. Inspect local diagnostics without exposing secrets.",
  NOT_CONFIGURED: "Website implementation and verification are not complete."
};
var AutomationError = class extends Error {
  code;
  step;
  hint;
  constructor(code, step, hint) {
    super(messages[code]);
    this.name = "AutomationError";
    this.code = code;
    this.step = step;
    this.hint = hint;
  }
};
function normalizeError(error) {
  if (error instanceof AutomationError) return error;
  if (error instanceof Error && /strict mode violation/i.test(error.message))
    return new AutomationError("AMBIGUOUS_SELECTOR");
  if (error instanceof Error && error.name === "TimeoutError")
    return new AutomationError("TIMEOUT");
  return new AutomationError("INTERNAL");
}
function exitCode(code) {
  if (["INVALID_INPUT", "UNKNOWN_ACTION"].includes(code)) return 2;
  if ([
    "AUTH_REQUIRED",
    "HUMAN_REQUIRED",
    "BROWSER_REQUIRED",
    "ATTACH_FAILED",
    "APPROVAL_REQUIRED"
  ].includes(code))
    return 3;
  if (["PLAN_USED", "UNKNOWN_COMMIT"].includes(code)) return 5;
  return 4;
}
function recovery(code) {
  if (["INVALID_INPUT", "UNKNOWN_ACTION"].includes(code)) return "fix-input";
  if ([
    "AUTH_REQUIRED",
    "HUMAN_REQUIRED",
    "BROWSER_REQUIRED",
    "ATTACH_FAILED",
    "APPROVAL_REQUIRED"
  ].includes(code))
    return "user-action";
  if ([
    "POSTCONDITION_FAILED",
    "CLI_PROTOCOL",
    "NOT_CONFIGURED",
    "BUILD_REQUIRED"
  ].includes(code))
    return "repair";
  if (["PLAN_CHANGED", "PLAN_EXPIRED"].includes(code)) return "replan";
  if ([
    "UI_DRIFT",
    "AMBIGUOUS_SELECTOR",
    "UNSUPPORTED_UI_STATE",
    "UNKNOWN_REGION",
    "PLAN_USED",
    "UNKNOWN_COMMIT",
    "BUSY",
    "TIMEOUT",
    "INTERNAL"
  ].includes(code))
    return "inspect-state";
  return "none";
}

// src/runtime/input.ts
import { createHash } from "node:crypto";
function invalid(step = "input", hint) {
  throw new AutomationError("INVALID_INPUT", step, hint);
}
function validateFields(fields) {
  for (const [name, field] of Object.entries(fields)) {
    const bounds = [field.min, field.max].filter(
      (value) => value !== void 0
    );
    const validBounds = bounds.every(Number.isFinite) && (!["string", "string[]"].includes(field.type) || bounds.every((value) => Number.isSafeInteger(value) && value >= 0)) && (field.type !== "integer" || bounds.every(Number.isSafeInteger)) && (field.min === void 0 || field.max === void 0 || field.min <= field.max);
    const validEnum = field.enum === void 0 || field.type === "string" && field.enum.length > 0 && new Set(field.enum).size === field.enum.length && field.enum.every((value) => typeof value === "string");
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || !field.description?.trim() || !validBounds || !validEnum)
      invalid(name, "Invalid field definition.");
    if (field.default !== void 0) validateInput({ [name]: field }, {});
  }
}
function validateInput(fields, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    invalid("input", "Expected a JSON object.");
  const record = raw;
  const unknown = Object.keys(record).find((k) => !Object.hasOwn(fields, k));
  if (unknown) invalid(unknown, "Unknown field.");
  const result = /* @__PURE__ */ Object.create(null);
  for (const [key, field] of Object.entries(fields)) {
    const value = Object.hasOwn(record, key) ? record[key] : field.default;
    if (value === void 0) {
      if (field.required) invalid(key, "Required field is missing.");
      continue;
    }
    let valid = false;
    switch (field.type) {
      case "string":
        valid = typeof value === "string";
        break;
      case "boolean":
        valid = typeof value === "boolean";
        break;
      case "number":
        valid = typeof value === "number" && Number.isFinite(value);
        break;
      case "integer":
        valid = typeof value === "number" && Number.isSafeInteger(value);
        break;
      case "string[]":
        valid = Array.isArray(value) && value.every((v) => typeof v === "string");
        break;
    }
    if (!valid) invalid(key, `Expected ${field.type}.`);
    const metric = typeof value === "string" || Array.isArray(value) ? value.length : value;
    if (typeof metric === "number" && (field.min !== void 0 && metric < field.min || field.max !== void 0 && metric > field.max))
      invalid(key, `Expected ${field.min ?? "-\u221E"}..${field.max ?? "\u221E"}.`);
    if (field.enum && (typeof value !== "string" || !field.enum.includes(value)))
      invalid(key, `Allowed: ${field.enum.join(", ")}.`);
    result[key] = Array.isArray(value) ? [...value] : value;
  }
  return result;
}
function jsonValue(value, seen = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || value === null || seen.has(value))
    throw new AutomationError("POSTCONDITION_FAILED");
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new AutomationError("POSTCONDITION_FAILED");
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map((v) => jsonValue(v, seen));
  else
    result = Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, jsonValue(v, seen)])
    );
  seen.delete(value);
  return result;
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
function digest(value) {
  return createHash("sha256").update(canonical(jsonValue(value))).digest("hex");
}

// src/runtime/engine.ts
function isJsonObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function boundedJson(value, maxBytes) {
  const result = jsonValue(value);
  if (Buffer.byteLength(JSON.stringify(result)) > maxBytes)
    throw new AutomationError(
      "POSTCONDITION_FAILED",
      "output",
      "Output exceeds configured limit."
    );
  return result;
}
function validatePreview(raw) {
  const value = jsonValue(raw);
  if (!isJsonObject(value))
    throw new AutomationError("POSTCONDITION_FAILED", "preview");
  const { target, version, changes } = value;
  if (!isJsonObject(target) || !Object.keys(target).length || typeof version !== "string" || !version.trim() || !isJsonObject(changes) || !Object.keys(changes).length || Object.keys(value).some(
    (k) => !["target", "version", "changes"].includes(k)
  ))
    throw new AutomationError("POSTCONDITION_FAILED", "preview");
  return { target, version, changes };
}
function validateRegistry(actions, configured) {
  const ids = actions.map((a) => a.id);
  const known = new Set(ids);
  const invalid2 = configured && actions.length === 0 || new Set(ids).size !== ids.length || actions.some((action) => {
    try {
      validateFields(action.parameters);
      validateInput(action.parameters, action.example);
    } catch {
      return true;
    }
    return !/^[a-z][a-zA-Z0-9]*(?:[.-][a-zA-Z0-9]+)*$/.test(action.id) || action.id.startsWith("browser.") || !action.description.trim() || !action.postcondition.trim() || !action.outputDescription.trim() || !action.modulePath || !Array.isArray(action.preconditions) || !Array.isArray(action.next) || action.preconditions.some((v) => typeof v !== "string" || !v.trim()) || new Set(action.next).size !== action.next.length || action.next.some((id) => !known.has(id));
  });
  if (invalid2) throw new AutomationError("NOT_CONFIGURED", "action-registry");
}
async function ensurePrivateDirectory(path) {
  await mkdir(path, { recursive: true, mode: 448 });
}
async function writeExclusiveJson(path, data) {
  const handle = await open(path, "wx", 384);
  try {
    await handle.writeFile(JSON.stringify(data));
    await handle.sync();
  } finally {
    await handle.close();
  }
}
function isAlreadyExists(error) {
  return error?.code === "EEXIST";
}
function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}
async function acquireLock(root2) {
  await ensurePrivateDirectory(root2);
  const path = join(root2, "runtime.lock");
  try {
    await writeExclusiveJson(path, {
      pid: process.pid,
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return path;
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  let stale = false;
  let ageMs = 0;
  try {
    const info = await stat(path);
    ageMs = Date.now() - info.mtimeMs;
    const raw = await readFile(path, "utf8");
    const lock = JSON.parse(raw);
    stale = typeof lock.pid === "number" && !processAlive(lock.pid) || typeof lock.pid !== "number" && ageMs > 3e5;
  } catch {
    stale = ageMs > 3e5;
  }
  if (!stale) throw new AutomationError("BUSY");
  const moved = path + ".stale." + randomUUID();
  try {
    await rename(path, moved);
    await unlink(moved).catch(() => {
    });
  } catch {
    throw new AutomationError("BUSY");
  }
  try {
    await writeExclusiveJson(path, {
      pid: process.pid,
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    return path;
  } catch (error) {
    if (isAlreadyExists(error)) throw new AutomationError("BUSY");
    throw error;
  }
}
async function withLock(root2, job) {
  const path = await acquireLock(root2);
  try {
    return await job();
  } finally {
    await unlink(path).catch(() => {
    });
  }
}
async function cleanupLocal(root2) {
  let plans = 0, bundles = 0;
  for (const [directory, kind] of [
    ["plans", "plans"],
    ["run-code", "bundles"]
  ]) {
    const dir = join(root2, directory);
    let files;
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      const path = join(dir, file);
      if (kind === "bundles") {
        if (file.endsWith(".js")) {
          await unlink(path).catch(() => {
          });
          bundles++;
        }
        continue;
      }
      try {
        const plan = JSON.parse(await readFile(path, "utf8"));
        if (typeof plan.expiresAt !== "number" || Date.now() >= plan.expiresAt) {
          await unlink(path);
          plans++;
        }
      } catch {
        await unlink(path).catch(() => {
        });
        plans++;
      }
    }
  }
  return { plans, bundles };
}
var Engine = class {
  root;
  config;
  actions;
  browser;
  constructor(root2, config, actions, browser) {
    this.root = root2;
    this.config = config;
    this.actions = actions;
    this.browser = browser;
    validateRegistry(actions, config.configured);
  }
  action(id) {
    const action = this.actions.find((a) => a.id === id);
    if (!action) throw new AutomationError("UNKNOWN_ACTION", id);
    return action;
  }
  list() {
    return this.actions.map(({ id }) => id);
  }
  describe(id) {
    const {
      id: action,
      kind,
      description,
      preconditions,
      postcondition,
      parameters,
      example,
      outputDescription,
      next
    } = this.action(id);
    return {
      action,
      kind,
      description,
      preconditions,
      postcondition,
      parameters,
      example,
      outputDescription,
      next
    };
  }
  async run(id, raw) {
    const action = this.action(id);
    if (action.kind !== "read")
      throw new AutomationError("APPROVAL_REQUIRED", id);
    const input = validateInput(action.parameters, raw);
    return withLock(this.root, async () => {
      const invoked = await this.browser(action, "run", input);
      return {
        action: id,
        state: invoked.state ?? "unknown",
        data: boundedJson(
          action.validateOutput(invoked.value),
          this.config.maxOutputBytes
        ),
        next: action.next
      };
    });
  }
  async plan(id, raw) {
    const action = this.action(id);
    if (action.kind !== "write") throw new AutomationError("INVALID_INPUT", id);
    const input = validateInput(action.parameters, raw);
    return withLock(this.root, async () => {
      const invoked = await this.browser(action, "prepare", input);
      const preview = validatePreview(invoked.value);
      const now = Date.now();
      const plan = {
        format: 1,
        id: randomUUID(),
        action: id,
        input,
        accountKey: invoked.accountKey,
        preview,
        configHash: digest(this.config),
        createdAt: now,
        expiresAt: now + this.config.planTtlMs
      };
      await ensurePrivateDirectory(join(this.root, "plans"));
      await writeExclusiveJson(
        join(this.root, "plans", plan.id + ".json"),
        plan
      );
      return {
        action: id,
        planId: plan.id,
        approvalHash: digest(plan),
        accountKey: plan.accountKey,
        expiresAt: new Date(plan.expiresAt).toISOString(),
        preview,
        requiresUserApproval: true,
        allowedNextActions: [],
        instruction: "Show this preview and stop. Execute only after explicit user approval."
      };
    });
  }
  async execute(id, approval) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id
    ) || !/^[0-9a-f]{64}$/.test(approval))
      throw new AutomationError("APPROVAL_REQUIRED");
    return withLock(this.root, async () => {
      const planPath = join(this.root, "plans", id + ".json");
      const marker = join(this.root, "attempts", id + ".json");
      try {
        await stat(marker);
        throw new AutomationError("PLAN_USED");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      let plan;
      try {
        plan = JSON.parse(await readFile(planPath, "utf8"));
      } catch {
        throw new AutomationError("APPROVAL_REQUIRED");
      }
      if (digest(plan) !== approval || plan.format !== 1 || plan.id !== id)
        throw new AutomationError("APPROVAL_REQUIRED");
      if (!Number.isFinite(plan.expiresAt) || Date.now() >= plan.expiresAt) {
        await unlink(planPath).catch(() => {
        });
        throw new AutomationError("PLAN_EXPIRED");
      }
      if (plan.configHash !== digest(this.config))
        throw new AutomationError("PLAN_CHANGED");
      const action = this.action(plan.action);
      if (action.kind !== "write") throw new AutomationError("PLAN_CHANGED");
      const input = validateInput(action.parameters, plan.input);
      if (digest(input) !== digest(plan.input))
        throw new AutomationError("PLAN_CHANGED");
      const fresh = await this.browser(action, "prepare", input, {
        accountKey: plan.accountKey
      });
      const freshPreview = validatePreview(fresh.value);
      if (fresh.accountKey !== plan.accountKey || digest(freshPreview) !== digest(plan.preview))
        throw new AutomationError("PLAN_CHANGED");
      if (Date.now() >= plan.expiresAt)
        throw new AutomationError("PLAN_EXPIRED");
      await ensurePrivateDirectory(join(this.root, "attempts"));
      try {
        await writeExclusiveJson(marker, {
          planId: id,
          status: "started",
          at: Date.now()
        });
      } catch (error) {
        if (isAlreadyExists(error)) throw new AutomationError("PLAN_USED");
        throw error;
      }
      try {
        const invoked = await this.browser(action, "execute", input, {
          accountKey: plan.accountKey,
          preview: freshPreview,
          expiresAt: plan.expiresAt
        });
        if (invoked.accountKey !== plan.accountKey)
          throw new Error("account changed");
        const result = boundedJson(
          action.validateOutput(invoked.value),
          this.config.maxOutputBytes
        );
        const temporary = marker + ".tmp";
        await writeFile(
          temporary,
          JSON.stringify({ planId: id, status: "completed", at: Date.now() }),
          { mode: 384 }
        );
        await rename(temporary, marker);
        await unlink(planPath).catch(() => {
        });
        return {
          action: action.id,
          planId: id,
          state: invoked.state ?? "unknown",
          data: result,
          next: action.next
        };
      } catch {
        await unlink(planPath).catch(() => {
        });
        throw new AutomationError("UNKNOWN_COMMIT");
      }
    });
  }
};

// src/runtime/cli-browser.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2, unlink as unlink2 } from "node:fs/promises";
import { join as join2 } from "node:path";
import { randomUUID as randomUUID2, createHash as createHash2 } from "node:crypto";
var exec = promisify(execFile);
function parseSessions(raw) {
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value.browsers) || value.browsers.some((v) => !v || typeof v.name !== "string"))
      throw new Error();
    return value.browsers;
  } catch {
    throw new AutomationError("CLI_PROTOCOL", "session-list");
  }
}
function sha256(value) {
  return createHash2("sha256").update(value).digest("hex");
}
function hasRunningBrowser(output, target, platform = process.platform) {
  const names = {
    chrome: [
      "Google Chrome",
      "google-chrome",
      "google-chrome-stable",
      "chrome",
      "chrome.exe"
    ],
    "chrome-beta": ["Google Chrome Beta", "google-chrome-beta"],
    "chrome-dev": ["Google Chrome Dev", "google-chrome-unstable"],
    "chrome-canary": ["Google Chrome Canary"],
    msedge: ["Microsoft Edge", "microsoft-edge", "msedge", "msedge.exe"]
  };
  const allowed = names[target];
  if (!allowed) return false;
  return output.split(/\r?\n/).some((line) => {
    const name = platform === "win32" ? line.match(/^"([^"]+)"/)?.[1] : line.trim().split("/").pop();
    return !!name && allowed.includes(name);
  });
}
async function requireRunningBrowser(target) {
  let output;
  try {
    output = (await exec(
      process.platform === "win32" ? "tasklist" : "ps",
      process.platform === "win32" ? ["/FO", "CSV", "/NH"] : ["-A", "-o", "comm="],
      { timeout: 5e3, maxBuffer: 2097152 }
    )).stdout;
  } catch {
    throw new AutomationError("ATTACH_FAILED", "browser-presence-check");
  }
  if (!hasRunningBrowser(output, target))
    throw new AutomationError("BROWSER_REQUIRED", "browser-presence-check");
}
var CliBrowser = class {
  project;
  root;
  config;
  constructor(project2, root2, config) {
    this.project = project2;
    this.root = root2;
    this.config = config;
  }
  async cli(args, purpose) {
    try {
      const script = this.config.browser.cliScript;
      const result = await exec(
        script ? process.execPath : this.config.browser.cliCommand,
        script ? [script, ...args] : args,
        {
          cwd: this.project,
          timeout: purpose === "runtime" ? this.config.actionBudgetMs : 3e4,
          maxBuffer: this.config.maxCliBytes,
          env: process.env
        }
      );
      return result.stdout.trim();
    } catch (raw) {
      const error = raw;
      const text = `${error.stdout ?? ""}
${error.stderr ?? ""}`;
      const missing = /browser.*(?:not running|not open)|no running browser|no browser.*running/i.test(
        text
      );
      throw new AutomationError(
        purpose === "attach" ? missing ? "BROWSER_REQUIRED" : "ATTACH_FAILED" : purpose === "runtime" ? "CLI_PROTOCOL" : "ATTACH_FAILED",
        purpose
      );
    }
  }
  async ensureAttached() {
    if (await this.cli(["--version"], "list") !== this.config.browser.cliVersion)
      throw new AutomationError("CLI_PROTOCOL", "playwright-cli-version");
    const find = async () => parseSessions(await this.cli(["list", "--json"], "list")).find(
      (v) => v.name === this.config.browser.session
    );
    const compatible = (v) => !!v && v.status === "open" && v.attached === true && v.compatible === true && (this.config.browser.attach.mode !== "extension" || v.browserType === this.config.browser.attach.target);
    const current = await find();
    if (current) {
      if (!compatible(current))
        throw new AutomationError("ATTACH_FAILED", "session-mismatch");
      return;
    }
    const { mode, target } = this.config.browser.attach;
    if (!["extension", "cdp"].includes(mode))
      throw new AutomationError("ATTACH_FAILED", "attach-config");
    if (mode === "extension") await requireRunningBrowser(target);
    await this.cli(
      [
        "attach",
        `--${mode}=${target}`,
        `--session=${this.config.browser.session}`
      ],
      "attach"
    );
    if (!compatible(await find()))
      throw new AutomationError("ATTACH_FAILED", "session-not-attached");
  }
  async invoke(bundle, request) {
    if (!/^actions\/[a-zA-Z0-9.-]+\.js$/.test(bundle.file))
      throw new AutomationError("BUILD_REQUIRED", "bundle-path");
    let code;
    try {
      code = await readFile2(join2(this.project, "runtime", bundle.file), "utf8");
    } catch {
      throw new AutomationError("BUILD_REQUIRED", "bundle-missing");
    }
    if (sha256(code) !== bundle.sha256 || Buffer.byteLength(code) > this.config.maxBundleBytes)
      throw new AutomationError("BUILD_REQUIRED", "bundle-integrity");
    await this.ensureAttached();
    const directory = join2(this.root, "run-code");
    await mkdir2(directory, { recursive: true, mode: 448 });
    const path = join2(directory, `${randomUUID2()}.js`);
    await writeFile2(
      path,
      `async page => { const invoke = ${code}; return await invoke(page, ${JSON.stringify(request)}); }`,
      { flag: "wx", mode: 384 }
    );
    try {
      const stdout = await this.cli(
        [
          `-s=${this.config.browser.session}`,
          "--raw",
          "run-code",
          `--filename=${path}`
        ],
        "runtime"
      );
      let value;
      try {
        value = JSON.parse(stdout);
        if (typeof value === "string") value = JSON.parse(value);
      } catch {
        throw new AutomationError("CLI_PROTOCOL", "run-code-output");
      }
      if (value?.ok === false) {
        const known = [
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
          "NOT_CONFIGURED"
        ];
        throw new AutomationError(
          known.includes(value.error?.code) ? value.error.code : "INTERNAL",
          value.error?.step
        );
      }
      if (value?.ok !== true || typeof value.accountKey !== "string" || !value.accountKey || Buffer.byteLength(JSON.stringify(value)) > this.config.maxOutputBytes)
        throw new AutomationError("CLI_PROTOCOL", "run-code-output");
      return value;
    } finally {
      await unlink2(path).catch(() => {
      });
    }
  }
  async domain(manifest, id, phase, input, guard) {
    if (!this.config.configured) throw new AutomationError("NOT_CONFIGURED");
    const action = manifest.actions.find((a) => a.id === id);
    if (!action) throw new AutomationError("UNKNOWN_ACTION");
    return this.invoke(action.bundle, { phase, input, guard });
  }
};

// src/cli.ts
process.umask(63);
var project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
var root = join3(project, ".local");
async function main() {
  let manifest;
  try {
    manifest = JSON.parse(
      await readFile3(join3(project, "runtime/manifest.json"), "utf8")
    );
    if (manifest.format !== 1 || !Array.isArray(manifest.actions) || !manifest.config || !manifest.observe)
      throw new Error();
  } catch {
    throw new AutomationError("BUILD_REQUIRED", "manifest");
  }
  const config = manifest.config;
  const browser = new CliBrowser(project, root, config);
  const unavailable = async () => {
    throw new AutomationError("BUILD_REQUIRED");
  };
  const registry = manifest.actions.map((a) => ({
    ...a,
    modulePath: a.bundle.file,
    parameters: a.input,
    postcondition: a.postconditions.join("; "),
    outputDescription: a.output.description,
    validateOutput: jsonValue,
    run: unavailable,
    prepare: unavailable,
    execute: unavailable
  }));
  const engine = new Engine(
    root,
    { ...config, implementationHash: digest(manifest) },
    registry,
    (action, phase, input2, guard) => browser.domain(manifest, action.id, phase, input2, guard)
  );
  let args;
  try {
    args = parseArgs({
      options: {
        json: { type: "string" },
        input: { type: "string" },
        plan: { type: "string" },
        approve: { type: "string" },
        mode: { type: "string" }
      },
      strict: true,
      allowPositionals: true
    });
  } catch {
    throw new AutomationError("INVALID_INPUT");
  }
  const [command, id, ...extra] = args.positionals;
  const mode = args.values.mode ?? "runtime";
  if (!["runtime", "diagnostic"].includes(mode))
    throw new AutomationError("INVALID_INPUT", "mode");
  function syntax(needsId, options) {
    if (extra.length || (needsId ? !id : !!id) || Object.keys(args.values).some((k) => ![...options, "mode"].includes(k)))
      throw new AutomationError("INVALID_INPUT");
  }
  async function input() {
    if (args.values.json !== void 0 && args.values.input !== void 0)
      throw new AutomationError("INVALID_INPUT");
    try {
      let text = args.values.json ?? "{}";
      if (args.values.input) {
        const info = await stat2(args.values.input);
        if (!info.isFile() || info.size > config.maxInputBytes)
          throw new Error();
        text = await readFile3(args.values.input, "utf8");
      }
      if (Buffer.byteLength(text) > config.maxInputBytes) throw new Error();
      return JSON.parse(text);
    } catch {
      throw new AutomationError("INVALID_INPUT");
    }
  }
  const observeIDs = [
    "browser.status",
    "browser.inspect",
    "browser.inspectRegion",
    "browser.screenshot"
  ];
  async function observation(action, raw = {}) {
    const input2 = validateInput(
      action === "browser.inspectRegion" ? {
        region: {
          type: "string",
          required: true,
          description: "Known region ID",
          min: 1,
          max: 80
        }
      } : {},
      raw
    );
    return withLock(root, async () => {
      const request = {
        action,
        mode,
        ...input2.region ? { region: input2.region } : {}
      };
      if (action === "browser.screenshot") {
        await mkdir3(join3(root, "screenshots"), {
          recursive: true,
          mode: 448
        });
        request.screenshotPath = join3(
          root,
          "screenshots",
          `${randomUUID3()}.png`
        );
      }
      return (await browser.invoke(manifest.observe.bundle, request)).value;
    });
  }
  switch (command) {
    case "list":
      syntax(false, []);
      return { actions: engine.list(), observe: observeIDs };
    case "describe": {
      syntax(true, []);
      if (observeIDs.includes(id))
        return {
          id,
          kind: "observe",
          global: true,
          input: id === "browser.inspectRegion" ? { region: "string|required; registered region ID" } : {}
        };
      const action = manifest.actions.find((a) => a.id === id);
      if (!action) throw new AutomationError("UNKNOWN_ACTION");
      const { bundle: _, ...contract } = action;
      return contract;
    }
    case "status":
      syntax(false, []);
      return observation("browser.status");
    case "inspect":
      syntax(false, []);
      return observation("browser.inspect");
    case "inspect-region":
      syntax(true, []);
      return observation("browser.inspectRegion", { region: id });
    case "screenshot":
      syntax(false, []);
      return observation("browser.screenshot");
    case "doctor": {
      syntax(false, []);
      return {
        session: config.browser.session,
        version: config.browser.cliVersion,
        attached: true,
        browserLaunch: false,
        configured: config.configured,
        ...await observation("browser.status")
      };
    }
    case "cleanup":
      syntax(false, []);
      return withLock(root, () => cleanupLocal(root));
    case "run":
      syntax(true, ["json", "input"]);
      if (observeIDs.includes(id)) return observation(id, await input());
      if (mode !== "runtime")
        throw new AutomationError(
          "INVALID_INPUT",
          "diagnostic-is-observation-only"
        );
      return await engine.run(id, await input());
    case "plan":
      syntax(true, ["json", "input"]);
      if (mode !== "runtime")
        throw new AutomationError(
          "INVALID_INPUT",
          "diagnostic-is-observation-only"
        );
      return await engine.plan(id, await input());
    case "execute":
      syntax(false, ["plan", "approve"]);
      if (mode !== "runtime")
        throw new AutomationError(
          "INVALID_INPUT",
          "diagnostic-is-observation-only"
        );
      return await engine.execute(
        args.values.plan ?? "",
        args.values.approve ?? ""
      );
    default:
      throw new AutomationError("INVALID_INPUT");
  }
}
main().then(
  (data) => process.stdout.write(JSON.stringify({ ok: true, ...data }) + "\n")
).catch((raw) => {
  const error = normalizeError(raw);
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: error.code,
      ...error.step ? { step: error.step.slice(0, 120) } : {},
      recovery: recovery(error.code),
      ...["PLAN_USED", "UNKNOWN_COMMIT"].includes(error.code) ? { mayHaveCommitted: true } : {}
    }) + "\n"
  );
  process.exitCode = exitCode(error.code);
});
