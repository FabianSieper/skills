import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";
import {
  Engine,
  withLock,
  type RegisteredAction,
  type BrowserExecutor,
} from "../src/runtime/engine.ts";
import { AutomationError } from "../src/runtime/errors.ts";
import { jsonValue } from "../src/runtime/input.ts";

type PlanResult = { planId: string; approvalHash: string };
function code(expected: string) {
  return (e: unknown) => e instanceof AutomationError && e.code === expected;
}
async function fixture(
  job: (f: ReturnType<typeof make>) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "website-engine-"));
  try {
    await job(make(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
function make(root: string) {
  const state = {
    account: "account-a",
    revision: 1,
    writes: 0,
    throwAfter: false,
    badOutput: false,
  };
  const modulePath = "/fixture/action.ts";
  const actions: RegisteredAction[] = [
    {
      id: "item.read",
      kind: "read",
      description: "Read",
      preconditions: ["Ready"],
      postcondition: "Revision returned",
      parameters: {},
      example: {},
      outputDescription: "Revision",
      modulePath,
      next: ["item.update"],
      run: async () => ({ revision: state.revision }),
      validateOutput: jsonValue,
    },
    {
      id: "item.update",
      kind: "write",
      description: "Update",
      preconditions: ["Ready"],
      postcondition: "Value saved",
      parameters: {
        value: {
          type: "integer",
          description: "New value",
          required: true,
          min: 0,
          max: 99,
        },
      },
      example: { value: 7 },
      outputDescription: "Updated value",
      modulePath,
      next: ["item.read"],
      prepare: async (_, input) => ({
        target: { targetId: "one" },
        version: String(state.revision),
        changes: { value: input.value! },
      }),
      execute: async (_, input) => {
        state.writes++;
        if (state.throwAfter) throw new Error("lost");
        if (state.badOutput) return { value: undefined };
        return { value: input.value };
      },
      validateOutput: (value) => {
        const raw = value as { value?: unknown };
        if (typeof raw.value !== "number")
          throw new AutomationError("POSTCONDITION_FAILED");
        return jsonValue(value);
      },
    },
  ];
  const browser: BrowserExecutor = async (action, phase, input, guard) => {
    if (action.kind === "read" && phase === "run")
      return {
        accountKey: state.account,
        value: (await action.run({} as Page, input)) as never,
      };
    if (action.kind !== "write") throw new Error("fixture");
    if (phase === "prepare")
      return {
        accountKey: state.account,
        value: (await action.prepare({} as Page, input)) as never,
      };
    if (guard && guard.accountKey !== state.account)
      throw new AutomationError("PLAN_CHANGED");
    if (phase === "execute")
      return {
        accountKey: state.account,
        value: action.validateOutput(
          await action.execute({} as Page, input, guard!.preview!),
        ) as never,
      };
    throw new Error("fixture");
  };
  const config = {
    name: "fixture",
    version: 1,
    configured: true,
    planTtlMs: 600000,
    maxOutputBytes: 4096,
  };
  const engine = new Engine(root, config, actions, browser);
  return {
    root,
    state,
    actions,
    browser,
    config,
    engine,
    plan: async () =>
      (await engine.plan("item.update", { value: 7 })) as PlanResult,
  };
}
test("describe contract and read action include next actions", () =>
  fixture(async (f) => {
    assert.deepEqual(
      (f.engine.describe("item.read") as { next: string[] }).next,
      ["item.update"],
    );
    assert.deepEqual(await f.engine.run("item.read", {}), {
      action: "item.read",
      state: "unknown",
      data: { revision: 1 },
      next: ["item.update"],
    });
    await assert.rejects(
      () => f.engine.run("unknown", {}),
      code("UNKNOWN_ACTION"),
    );
  }));
test("write cannot run through read command; preview makes no mutation", () =>
  fixture(async (f) => {
    await assert.rejects(
      () => f.engine.run("item.update", { value: 7 }),
      code("APPROVAL_REQUIRED"),
    );
    const p = await f.plan();
    assert.ok(p.planId);
    assert.equal(f.state.writes, 0);
    assert.deepEqual(
      (p as PlanResult & { allowedNextActions: string[] }).allowedNextActions,
      [],
    );
  }));
test("changed account or target revision blocks execution", () =>
  fixture(async (f) => {
    const p = await f.plan();
    f.state.account = "account-b";
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("PLAN_CHANGED"),
    );
    f.state.account = "account-a";
    f.state.revision++;
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("PLAN_CHANGED"),
    );
    assert.equal(f.state.writes, 0);
  }));
test("successful write is verified and cannot be replayed", () =>
  fixture(async (f) => {
    const p = await f.plan();
    const result = (await f.engine.execute(p.planId, p.approvalHash)) as {
      next: string[];
    };
    assert.equal(f.state.writes, 1);
    assert.deepEqual(result.next, ["item.read"]);
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("PLAN_USED"),
    );
  }));
test("lost response after write becomes UNKNOWN_COMMIT and blocks replay", () =>
  fixture(async (f) => {
    const p = await f.plan();
    f.state.throwAfter = true;
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("UNKNOWN_COMMIT"),
    );
    assert.equal(f.state.writes, 1);
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("PLAN_USED"),
    );
  }));
test("invalid result after a write is UNKNOWN_COMMIT", () =>
  fixture(async (f) => {
    const p = await f.plan();
    f.state.badOutput = true;
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("UNKNOWN_COMMIT"),
    );
  }));
test("changed implementation blocks execution", () =>
  fixture(async (f) => {
    const p = await f.plan();
    f.config.version++;
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("PLAN_CHANGED"),
    );
  }));
test("expired unused plan blocks execution", () =>
  fixture(async (f) => {
    f.config.planTtlMs = -1;
    const p = await f.plan();
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("PLAN_EXPIRED"),
    );
    assert.equal(f.state.writes, 0);
  }));
test("attempt marker survives removal of sensitive plan data", () =>
  fixture(async (f) => {
    const p = await f.plan();
    await f.engine.execute(p.planId, p.approvalHash);
    await assert.rejects(
      () => readFile(join(f.root, "plans", p.planId + ".json"), "utf8"),
      { code: "ENOENT" },
    );
    await assert.rejects(
      () => f.engine.execute(p.planId, p.approvalHash),
      code("PLAN_USED"),
    );
  }));
test("concurrent run is blocked by project lock", () =>
  fixture(async (f) => {
    await withLock(f.root, async () => {
      await assert.rejects(() => f.engine.run("item.read", {}), code("BUSY"));
    });
    await f.engine.run("item.read", {});
  }));
test("only old malformed locks are reclaimed", () =>
  fixture(async (f) => {
    const lock = join(f.root, "runtime.lock");
    await writeFile(lock, "{");
    await assert.rejects(() => f.engine.run("item.read", {}), code("BUSY"));
    const old = new Date(Date.now() - 600_000);
    await utimes(lock, old, old);
    await f.engine.run("item.read", {});
  }));
test("configured registries reject dangling next actions", () =>
  fixture(async (f) => {
    const broken = [{ ...f.actions[0]!, next: ["missing"] }];
    assert.throws(
      () => new Engine(f.root, f.config, broken, f.browser),
      code("NOT_CONFIGURED"),
    );
  }));
test("preview requires target, version and changes objects", () =>
  fixture(async (f) => {
    (f.actions[1] as Extract<RegisteredAction, { kind: "write" }>).prepare =
      async () =>
        ({ target: "bad", version: "1", changes: { value: 7 } }) as never;
    await assert.rejects(() => f.plan(), code("POSTCONDITION_FAILED"));
  }));
