import test from "node:test";
import assert from "node:assert/strict";
import type { Locator } from "playwright";
import {
  uniqueVisible,
  clickUnique,
  fillUnique,
  allowedURL,
} from "../src/runtime/guards.ts";
import { AutomationError } from "../src/runtime/errors.ts";

function locator(count: number, waitFails = false) {
  const calls = { click: 0, fill: "" };
  const value = {
    waitFor: async () => {
      if (waitFails) throw new Error("missing");
    },
    count: async () => count,
    click: async () => {
      calls.click++;
    },
    fill: async (v: string) => {
      calls.fill = v;
    },
  } as unknown as Locator;
  return { value, calls };
}
function code(expected: string) {
  return (e: unknown) => e instanceof AutomationError && e.code === expected;
}
test("unique actions require exactly one visible match", async () => {
  const one = locator(1);
  await clickUnique(one.value, "click");
  await fillUnique(one.value, "x", "fill");
  assert.deepEqual(one.calls, { click: 1, fill: "x" });
  await assert.rejects(
    () => uniqueVisible(locator(2).value, "duplicate"),
    code("AMBIGUOUS_SELECTOR"),
  );
  await assert.rejects(
    () => uniqueVisible(locator(0, true).value, "missing"),
    code("UI_DRIFT"),
  );
});
test("origin validation rejects credentials and lookalikes", () => {
  assert.equal(
    allowedURL("https://example.org/items", ["https://example.org"]),
    "https://example.org/items",
  );
  for (const url of [
    "https://example.org.evil.test",
    "https://evil.test",
    "https://u:p@example.org",
    "javascript:alert(1)",
    "https://example.org\\@evil.test/",
    "https://example.org\t@evil.test/",
    "https://example.org:444/items",
  ])
    assert.throws(
      () => allowedURL(url, ["https://example.org"]),
      AutomationError,
    );
});
