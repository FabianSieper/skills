import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSessions,
  hasRunningBrowser,
} from "../src/runtime/cli-browser.ts";
import { compileBrowser } from "../src/build.ts";
test("strict session protocol", () => {
  assert.equal(
    parseSessions('{"browsers":[{"name":"site"}]}')[0]?.name,
    "site",
  );
  assert.throws(() => parseSessions('{"channelSessions":[]}'));
  assert.throws(() => parseSessions('{"browsers":[null]}'));
});
test("browser presence checks exact main processes, not helpers or substrings", () => {
  assert.equal(
    hasRunningBrowser(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n",
      "chrome",
      "darwin",
    ),
    true,
  );
  assert.equal(
    hasRunningBrowser("/opt/google/chrome/chrome\n", "chrome", "linux"),
    true,
  );
  assert.equal(
    hasRunningBrowser('"chrome.exe","123","Console"', "chrome", "win32"),
    true,
  );
  for (const value of [
    "",
    "/Applications/Google Chrome Helper",
    "/tmp/not-chrome",
    "node",
  ])
    assert.equal(hasRunningBrowser(value, "chrome", "darwin"), false);
});
test("build emits a reusable browser function and rejects Node modules", async () => {
  const code = await compileBrowser(
    "export async function invoke(page, request) { return request.input; }",
    process.cwd(),
    8192,
  );
  assert.match(code, /^async \(page, request\) =>/);
  const fn = new Function("return (" + code + ")")();
  assert.deepEqual(await fn({}, { input: { value: 7 } }), { value: 7 });
  await assert.rejects(() =>
    compileBrowser(
      'import {readFile} from "node:fs"; export const invoke=readFile;',
      process.cwd(),
      8192,
    ),
  );
});
