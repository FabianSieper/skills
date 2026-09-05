#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: { out: { type: "string" }, offline: { type: "boolean" } },
  strict: true,
});
const directory = dirname(fileURLToPath(import.meta.url));
const root = values.out
  ? resolve(values.out)
  : await mkdtemp(join(tmpdir(), "website-builder-verified-"));
const out = join(root, "demo-automation");
function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    timeout: 180000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed`);
}
run(process.execPath, [
  join(directory, "scaffold.mjs"),
  "--name",
  "demo-automation",
  "--url",
  "http://127.0.0.1:4173",
  "--out",
  out,
  "--demo",
]);
run(
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...(values.offline ? ["--offline"] : []),
  ],
  out,
);
for (const step of ["typecheck", "build", "test"])
  run("npm", ["run", step], out);
const statePath = join(out, "references/build-state.json");
const state = JSON.parse(await readFile(statePath, "utf8"));
state.phase = "HANDOFF";
for (const action of Object.values(state.actions)) {
  action.fixture = "pass";
  action.remainingRisk =
    "Protocol subprocess and deterministic Page double passed. Real Chrome execution of this generated skill is not covered by this run.";
}
state.next =
  "Review fixture evidence; perform separate live attach/read verification";
await writeFile(statePath, JSON.stringify(state, null, 2) + "\n");
await writeFile(
  join(out, "references/verification.md"),
  `# Executed fixture verification\n\nNode ${process.versions.node}; ${new Date().toISOString()}. Typecheck, precompiled build, unit and subprocess integration tests passed. The fixture server served its HTML over localhost. Portable Runtime was executed without src or node_modules.\n\nTransport: executable CLI double with the real compiled POM wrappers; browser calls were simulated. This is not a live Chrome test. No real business write occurred.\n`,
);
run("npm", ["run", "validate"], out);
console.log(
  JSON.stringify({
    ok: true,
    status: "demo-verified",
    path: out,
    live: "not-run",
  }),
);
