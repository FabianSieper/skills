import {
  mkdir,
  open,
  readFile,
  stat,
  writeFile,
  rename,
  unlink,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Page } from "playwright";
import { AutomationError } from "./errors.ts";
import {
  digest,
  jsonValue,
  validateFields,
  validateInput,
  type Fields,
  type Input,
  type Json,
} from "./input.ts";

export interface Preview {
  target: Record<string, Json>;
  version: string;
  changes: Record<string, Json>;
}
interface ActionContract {
  id: string;
  description: string;
  preconditions: readonly string[];
  postcondition: string;
  parameters: Fields;
  example: Input;
  outputDescription: string;
  validateOutput: (value: unknown) => Json;
  next: readonly string[];
}
export type Action = ActionContract &
  (
    | { kind: "read"; run: (page: Page, input: Input) => Promise<unknown> }
    | {
        kind: "write";
        prepare: (page: Page, input: Input) => Promise<Preview>;
        execute: (
          page: Page,
          input: Input,
          preview: Preview,
        ) => Promise<unknown>;
      }
  );
export type RegisteredAction = Action & { modulePath: string };
export function registerAction(
  action: Action,
  moduleURL: URL,
): RegisteredAction {
  return Object.freeze({ ...action, modulePath: fileURLToPath(moduleURL) });
}
export interface ExecuteGuard {
  accountKey: string;
  preview?: Preview;
  expiresAt?: number;
}
export interface BrowserInvocation {
  accountKey: string;
  value: Json;
  state?: string;
}
export type BrowserExecutor = (
  action: RegisteredAction,
  phase: "run" | "prepare" | "execute",
  input: Input,
  guard?: ExecuteGuard,
) => Promise<BrowserInvocation>;
export interface RuntimeConfig {
  name: string;
  version: number;
  configured: boolean;
  planTtlMs: number;
  maxOutputBytes: number;
  [key: string]: unknown;
}
interface Plan {
  format: 1;
  id: string;
  action: string;
  input: Input;
  accountKey: string;
  preview: Preview;
  configHash: string;
  createdAt: number;
  expiresAt: number;
}

function isJsonObject(value: unknown): value is Record<string, Json> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
function boundedJson(value: unknown, maxBytes: number): Json {
  const result = jsonValue(value);
  if (Buffer.byteLength(JSON.stringify(result)) > maxBytes)
    throw new AutomationError(
      "POSTCONDITION_FAILED",
      "output",
      "Output exceeds configured limit.",
    );
  return result;
}
function validatePreview(raw: unknown): Preview {
  const value = jsonValue(raw) as unknown;
  if (!isJsonObject(value))
    throw new AutomationError("POSTCONDITION_FAILED", "preview");
  const { target, version, changes } = value;
  if (
    !isJsonObject(target) ||
    !Object.keys(target).length ||
    typeof version !== "string" ||
    !version.trim() ||
    !isJsonObject(changes) ||
    !Object.keys(changes).length ||
    Object.keys(value).some(
      (k) => !["target", "version", "changes"].includes(k),
    )
  )
    throw new AutomationError("POSTCONDITION_FAILED", "preview");
  return { target, version, changes };
}
function validateRegistry(
  actions: readonly RegisteredAction[],
  configured: boolean,
): void {
  const ids = actions.map((a) => a.id);
  const known = new Set(ids);
  const invalid =
    (configured && actions.length === 0) ||
    new Set(ids).size !== ids.length ||
    actions.some((action) => {
      try {
        validateFields(action.parameters);
        validateInput(action.parameters, action.example);
      } catch {
        return true;
      }
      return (
        !/^[a-z][a-zA-Z0-9]*(?:[.-][a-zA-Z0-9]+)*$/.test(action.id) ||
        action.id.startsWith("browser.") ||
        !action.description.trim() ||
        !action.postcondition.trim() ||
        !action.outputDescription.trim() ||
        !action.modulePath ||
        !Array.isArray(action.preconditions) ||
        !Array.isArray(action.next) ||
        action.preconditions.some((v) => typeof v !== "string" || !v.trim()) ||
        new Set(action.next).size !== action.next.length ||
        action.next.some((id) => !known.has(id))
      );
    });
  if (invalid) throw new AutomationError("NOT_CONFIGURED", "action-registry");
}
async function ensurePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
}
async function writeExclusiveJson(path: string, data: unknown): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(data));
    await handle.sync();
  } finally {
    await handle.close();
  }
}
function isAlreadyExists(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "EEXIST";
}
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
async function acquireLock(root: string): Promise<string> {
  await ensurePrivateDirectory(root);
  const path = join(root, "runtime.lock");
  try {
    await writeExclusiveJson(path, {
      pid: process.pid,
      startedAt: new Date().toISOString(),
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
    const lock = JSON.parse(raw) as { pid?: unknown };
    stale =
      (typeof lock.pid === "number" && !processAlive(lock.pid)) ||
      (typeof lock.pid !== "number" && ageMs > 300_000);
  } catch {
    // A newly created lock may not be fully written yet. Only reclaim old damage.
    stale = ageMs > 300_000;
  }
  if (!stale) throw new AutomationError("BUSY");
  const moved = path + ".stale." + randomUUID();
  try {
    await rename(path, moved);
    await unlink(moved).catch(() => {});
  } catch {
    throw new AutomationError("BUSY");
  }
  try {
    await writeExclusiveJson(path, {
      pid: process.pid,
      startedAt: new Date().toISOString(),
    });
    return path;
  } catch (error) {
    if (isAlreadyExists(error)) throw new AutomationError("BUSY");
    throw error;
  }
}
export async function withLock<T>(
  root: string,
  job: () => Promise<T>,
): Promise<T> {
  const path = await acquireLock(root);
  try {
    return await job();
  } finally {
    await unlink(path).catch(() => {});
  }
}
export async function cleanupLocal(
  root: string,
): Promise<{ plans: number; bundles: number }> {
  let plans = 0,
    bundles = 0;
  for (const [directory, kind] of [
    ["plans", "plans"],
    ["run-code", "bundles"],
  ] as const) {
    const dir = join(root, directory);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      const path = join(dir, file);
      if (kind === "bundles") {
        if (file.endsWith(".js")) {
          await unlink(path).catch(() => {});
          bundles++;
        }
        continue;
      }
      try {
        const plan = JSON.parse(await readFile(path, "utf8")) as {
          expiresAt?: unknown;
        };
        if (
          typeof plan.expiresAt !== "number" ||
          Date.now() >= plan.expiresAt
        ) {
          await unlink(path);
          plans++;
        }
      } catch {
        await unlink(path).catch(() => {});
        plans++;
      }
    }
  }
  return { plans, bundles };
}

export class Engine {
  readonly root: string;
  readonly config: RuntimeConfig;
  readonly actions: readonly RegisteredAction[];
  readonly browser: BrowserExecutor;
  constructor(
    root: string,
    config: RuntimeConfig,
    actions: readonly RegisteredAction[],
    browser: BrowserExecutor,
  ) {
    this.root = root;
    this.config = config;
    this.actions = actions;
    this.browser = browser;
    validateRegistry(actions, config.configured);
  }
  action(id: string): RegisteredAction {
    const action = this.actions.find((a) => a.id === id);
    if (!action) throw new AutomationError("UNKNOWN_ACTION", id);
    return action;
  }
  list(): string[] {
    return this.actions.map(({ id }) => id);
  }
  describe(id: string): object {
    const {
      id: action,
      kind,
      description,
      preconditions,
      postcondition,
      parameters,
      example,
      outputDescription,
      next,
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
      next,
    };
  }
  async run(id: string, raw: unknown): Promise<unknown> {
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
          this.config.maxOutputBytes,
        ),
        next: action.next,
      };
    });
  }
  async plan(id: string, raw: unknown): Promise<unknown> {
    const action = this.action(id);
    if (action.kind !== "write") throw new AutomationError("INVALID_INPUT", id);
    const input = validateInput(action.parameters, raw);
    return withLock(this.root, async () => {
      const invoked = await this.browser(action, "prepare", input);
      const preview = validatePreview(invoked.value);
      const now = Date.now();
      const plan: Plan = {
        format: 1,
        id: randomUUID(),
        action: id,
        input,
        accountKey: invoked.accountKey,
        preview,
        configHash: digest(this.config),
        createdAt: now,
        expiresAt: now + this.config.planTtlMs,
      };
      await ensurePrivateDirectory(join(this.root, "plans"));
      await writeExclusiveJson(
        join(this.root, "plans", plan.id + ".json"),
        plan,
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
        instruction:
          "Show this preview and stop. Execute only after explicit user approval.",
      };
    });
  }
  async execute(id: string, approval: string): Promise<unknown> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        id,
      ) ||
      !/^[0-9a-f]{64}$/.test(approval)
    )
      throw new AutomationError("APPROVAL_REQUIRED");
    return withLock(this.root, async () => {
      const planPath = join(this.root, "plans", id + ".json");
      const marker = join(this.root, "attempts", id + ".json");
      try {
        await stat(marker);
        throw new AutomationError("PLAN_USED");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      let plan: Plan;
      try {
        plan = JSON.parse(await readFile(planPath, "utf8")) as Plan;
      } catch {
        throw new AutomationError("APPROVAL_REQUIRED");
      }
      if (digest(plan) !== approval || plan.format !== 1 || plan.id !== id)
        throw new AutomationError("APPROVAL_REQUIRED");
      if (!Number.isFinite(plan.expiresAt) || Date.now() >= plan.expiresAt) {
        await unlink(planPath).catch(() => {});
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
        accountKey: plan.accountKey,
      });
      const freshPreview = validatePreview(fresh.value);
      if (
        fresh.accountKey !== plan.accountKey ||
        digest(freshPreview) !== digest(plan.preview)
      )
        throw new AutomationError("PLAN_CHANGED");
      if (Date.now() >= plan.expiresAt)
        throw new AutomationError("PLAN_EXPIRED");
      await ensurePrivateDirectory(join(this.root, "attempts"));
      try {
        await writeExclusiveJson(marker, {
          planId: id,
          status: "started",
          at: Date.now(),
        });
      } catch (error) {
        if (isAlreadyExists(error)) throw new AutomationError("PLAN_USED");
        throw error;
      }
      try {
        const invoked = await this.browser(action, "execute", input, {
          accountKey: plan.accountKey,
          preview: freshPreview,
          expiresAt: plan.expiresAt,
        });
        if (invoked.accountKey !== plan.accountKey)
          throw new Error("account changed");
        const result = boundedJson(
          action.validateOutput(invoked.value),
          this.config.maxOutputBytes,
        );
        const temporary = marker + ".tmp";
        await writeFile(
          temporary,
          JSON.stringify({ planId: id, status: "completed", at: Date.now() }),
          { mode: 0o600 },
        );
        await rename(temporary, marker);
        await unlink(planPath).catch(() => {});
        return {
          action: action.id,
          planId: id,
          state: invoked.state ?? "unknown",
          data: result,
          next: action.next,
        };
      } catch {
        await unlink(planPath).catch(() => {});
        throw new AutomationError("UNKNOWN_COMMIT");
      }
    });
  }
}
