#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const script = join(dirname(fileURLToPath(import.meta.url)), "scaffold.mjs");
const root = await mkdtemp(join(tmpdir(), "builder-test-"));
try {
  const out = join(root, "example-automation");
  const run = (args) =>
    spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  assert.equal(run(["--help"]).status, 0);
  assert.notEqual(
    run([
      "--name",
      "example",
      "--url",
      "https://example.org",
      "--out",
      join(root, "example"),
    ]).status,
    0,
  );
  const created = run([
    "--name",
    "example-automation",
    "--url",
    "https://example.org",
    "--out",
    out,
  ]);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).status, "build_required");
  const skill = await readFile(join(out, "SKILL.md"), "utf8");
  assert.match(skill, /example-automation/);
  assert.doesNotMatch(skill, /\{\{SLUG\}\}/);
  assert.match(skill, /scripts\/site-runtime.mjs/);
  assert.match(skill, /inspect-region/);
  assert.equal(
    await stat(join(out, "agents/openai.yaml")).catch(() => null),
    null,
  );
  const runtime = await readFile(
    join(out, "src/runtime/cli-browser.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    runtime,
    /from "esbuild"|buildBrowserBundle|chromium\.launch/,
  );
  assert.match(runtime, /execFile/);
  for (const url of [
    "https://user:pass@example.org",
    "https://example.org?secret=1",
    "http://public.example.org",
  ]) {
    assert.notEqual(
      run([
        "--name",
        "unsafe-automation",
        "--url",
        url,
        "--out",
        join(root, "unsafe-automation"),
      ]).status,
      0,
    );
  }
  const demo = join(root, "nested/demo-automation");
  assert.equal(
    run([
      "--name",
      "demo-automation",
      "--url",
      "http://127.0.0.1:4173",
      "--out",
      demo,
      "--demo",
    ]).status,
    0,
  );
  assert.match(
    await readFile(join(demo, "src/actions/index.ts"), "utf8"),
    /inventory.find/,
  );
  assert.notEqual(
    run([
      "--name",
      "public-automation",
      "--url",
      "https://example.org",
      "--out",
      join(root, "public-automation"),
      "--demo",
    ]).status,
    0,
  );
  assert.notEqual(
    run([
      "--name",
      "example-automation",
      "--url",
      "https://example.org",
      "--out",
      out,
    ]).status,
    0,
  );
  console.log(JSON.stringify({ ok: true, status: "scaffold-verified" }));
} finally {
  await rm(root, { recursive: true, force: true });
}
