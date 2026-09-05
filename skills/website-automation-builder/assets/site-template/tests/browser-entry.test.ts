import test from "node:test";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { invokeAction } from "../src/runtime/browser-entry.ts";
import type { Action, Preview } from "../src/runtime/engine.ts";

const page = { url: () => "https://example.org/items" } as Page;
class ReadyPage {
  constructor(_page: Page) {}
  async assertReady(): Promise<{ accountKey: string }> {
    return { accountKey: "account-a" };
  }
}
function writeAction(state: { version: string; writes: number }): Action {
  return {
    id: "item.update",
    kind: "write",
    next: [],
    description: "Update",
    preconditions: ["Ready"],
    postcondition: "Saved",
    parameters: {},
    example: {},
    outputDescription: "Saved item",
    prepare: async () => ({
      target: { id: "one" },
      version: state.version,
      changes: { title: "new" },
    }),
    execute: async () => {
      state.writes++;
      return { saved: true };
    },
    validateOutput: (value) => value as never,
  };
}

test("write execution rechecks account and preview immediately before commit", async () => {
  const state = { version: "1", writes: 0 };
  const preview: Preview = {
    target: { id: "one" },
    version: "1",
    changes: { title: "new" },
  };
  const options = {
    phase: "execute" as const,
    input: {},
    guard: { accountKey: "account-a", preview },
    allowedOrigins: ["https://example.org"],
  };

  assert.deepEqual(
    await invokeAction(page, writeAction(state), ReadyPage, options),
    {
      ok: true,
      accountKey: "account-a",
      value: { saved: true },
    },
  );
  assert.equal(state.writes, 1);

  state.version = "2";
  const changed = await invokeAction(
    page,
    writeAction(state),
    ReadyPage,
    options,
  );
  assert.deepEqual(changed, {
    ok: false,
    error: { code: "PLAN_CHANGED", step: "preview" },
  });
  assert.equal(state.writes, 1);
});

test("wrong account and origin fail before a write", async () => {
  const state = { version: "1", writes: 0 };
  const preview: Preview = {
    target: { id: "one" },
    version: "1",
    changes: { title: "new" },
  };
  const wrongAccount = await invokeAction(page, writeAction(state), ReadyPage, {
    phase: "execute",
    input: {},
    guard: { accountKey: "account-b", preview },
    allowedOrigins: ["https://example.org"],
  });
  assert.deepEqual(wrongAccount, {
    ok: false,
    error: { code: "PLAN_CHANGED", step: "account" },
  });

  const wrongOrigin = await invokeAction(page, writeAction(state), ReadyPage, {
    phase: "execute",
    input: {},
    guard: { accountKey: "account-a", preview },
    allowedOrigins: ["https://other.example"],
  });
  assert.deepEqual(wrongOrigin, {
    ok: false,
    error: { code: "UI_DRIFT", step: "navigation-origin" },
  });
  assert.equal(state.writes, 0);
});
