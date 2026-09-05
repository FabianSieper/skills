#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
