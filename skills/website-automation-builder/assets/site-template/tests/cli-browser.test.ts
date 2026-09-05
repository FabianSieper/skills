import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBrowserBundle,
  parseSessions,
} from "../src/runtime/cli-browser.ts";
import type { RegisteredAction } from "../src/runtime/engine.ts";
import { AutomationError } from "../src/runtime/errors.ts";

test("session parsing uses exact browser entries", () => {
  const raw = JSON.stringify({
    browsers: [{ name: "site", status: "open", attached: true }],
    channelSessions: [{ channel: "site" }],
  });
  assert.deepEqual(parseSessions(raw), [
    { name: "site", status: "open", attached: true },
  ]);
  assert.throws(() => parseSessions('{"channelSessions":[]}'), AutomationError);
});
test("browser bundle is one function without Node module syntax", async () => {
  const project = await mkdtemp(join(tmpdir(), "site-bundle-"));
  try {
    await mkdir(join(project, "src/actions"), { recursive: true });
    await mkdir(join(project, "src/pages"), { recursive: true });
    await mkdir(join(project, "src/runtime"), { recursive: true });
    const modulePath = join(project, "src/actions/read.ts");
    await writeFile(
      modulePath,
      `export const action={kind:'read',run:async()=>({value:'ok'})};`,
    );
    await writeFile(
      join(project, "src/pages/SitePage.ts"),
      `export class SitePage{constructor(page){this.page=page}async assertReady(){return {accountKey:'public'}}}`,
    );
    await writeFile(
      join(project, "src/runtime/browser-entry.ts"),
      `export async function invokeAction(page,action,SitePage,options){return {ok:true,accountKey:'public',value:await action.run(page,options.input)}}`,
    );
    const action = {
      id: "item.read",
      kind: "read",
      description: "Read",
      preconditions: ["Ready"],
      postcondition: "Done",
      parameters: {},
      example: {},
      outputDescription: "Value",
      next: [],
      modulePath,
      run: async () => ({ value: "ok" }),
      validateOutput: (v) => v as never,
    } as RegisteredAction;
    const code = await buildBrowserBundle(project, action, "run", {});
    assert.match(code, /^async page =>/);
    assert.doesNotMatch(code, /\bimport\.meta\b|(^|[^\w$])require\s*\(/m);
    await writeFile(
      modulePath,
      `import {fileURLToPath} from 'node:url';export const action={kind:'read',path:fileURLToPath(import.meta.url),run:async()=>null};`,
    );
    await assert.rejects(
      () => buildBrowserBundle(project, action, "run", {}),
      (e: unknown) =>
        e instanceof AutomationError && e.code === "NOT_CONFIGURED",
    );
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});
