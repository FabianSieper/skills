#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  accessSync,
  constants,
  existsSync,
  statSync,
} from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

const NODE_MINIMUM = "22.16.0";
const PLAYWRIGHT_CLI_VERSION = "0.1.19";

function usage() {
  return `Usage: node scripts/check.mjs [--root <path>] [--json]

Read-only audit for the skills repository setup. The command exits with status 1
when a required prerequisite is missing or incompatible.`;
}

function parseVersion(value) {
  const match = String(value).match(/(?:^|\s|v)(\d+)\.(\d+)\.(\d+)(?:\b|$)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

function executableOnPath(name) {
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
      : [""];
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`);
      try {
        accessSync(candidate, constants.X_OK);
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // Continue looking through PATH.
      }
    }
  }
  return null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    timeout: options.timeout ?? 10_000,
    windowsHide: true,
  });
  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    error: result.error?.message,
  };
}

function isRepositoryRoot(directory) {
  return (
    existsSync(join(directory, "Taskfile.yml")) &&
    existsSync(join(directory, "README.md")) &&
    existsSync(join(directory, "skills", "website-automation-builder")) &&
    existsSync(
      join(directory, "skills", "cardmarket-automation", "package.json"),
    )
  );
}

function findRepositoryRoot(start) {
  let current = resolve(start);
  while (true) {
    if (isRepositoryRoot(current)) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function finding({
  id,
  label,
  status,
  expected,
  found = null,
  required = true,
  fix = null,
  detail = null,
}) {
  return { id, label, required, status, expected, found, fix, detail };
}

function commandFinding({
  id,
  label,
  command,
  args,
  expected,
  accept = () => true,
  fix,
}) {
  const path = executableOnPath(command);
  if (!path) {
    return finding({
      id,
      label,
      status: "missing",
      expected,
      fix,
      detail: `${command} is not on PATH`,
    });
  }
  const result = run(command, args);
  if (!result.ok) {
    return finding({
      id,
      label,
      status: "incompatible",
      expected,
      found: path,
      fix,
      detail: result.stderr || result.error || "version check failed",
    });
  }
  const found = result.stdout || result.stderr;
  return finding({
    id,
    label,
    status: accept(found) ? "ok" : "incompatible",
    expected,
    found,
    fix,
    detail: path,
  });
}

function localDependencies(root, npmAvailable) {
  const relative = join("skills", "cardmarket-automation");
  const directory = join(root, relative);
  const expected = "package-lock.json dependencies satisfied";
  if (!npmAvailable) {
    return finding({
      id: "cardmarket-dependencies",
      label: "Cardmarket npm dependencies",
      status: "blocked",
      expected,
      fix: `npm ci --prefix ${JSON.stringify(directory)}`,
      detail: "npm is unavailable",
    });
  }
  const result = run("npm", ["ls", "--depth=0", "--json"], {
    cwd: directory,
    timeout: 30_000,
  });
  return finding({
    id: "cardmarket-dependencies",
    label: "Cardmarket npm dependencies",
    status: result.ok ? "ok" : "missing",
    expected,
    found: result.ok ? "installed" : null,
    fix: `npm ci --prefix ${JSON.stringify(directory)}`,
    detail: result.ok
      ? relative
      : result.stderr || "npm reports missing or invalid dependencies",
  });
}

function chromeExtensionFinding(playwrightAvailable) {
  const expected = "installed for the Chrome channel when live automation is used";
  if (!playwrightAvailable) {
    return finding({
      id: "chrome-extension",
      label: "Playwright Chrome extension",
      required: false,
      status: "blocked",
      expected,
      detail: "Playwright CLI is unavailable",
    });
  }
  const result = run("playwright-cli", ["list", "--json", "--all"]);
  if (!result.ok) {
    return finding({
      id: "chrome-extension",
      label: "Playwright Chrome extension",
      required: false,
      status: "unknown",
      expected,
      detail: result.stderr || "could not inspect Playwright CLI channels",
    });
  }
  try {
    const channels = JSON.parse(result.stdout).channelSessions;
    const chrome = Array.isArray(channels)
      ? channels.find((entry) => entry.channel === "chrome")
      : null;
    return finding({
      id: "chrome-extension",
      label: "Playwright Chrome extension",
      required: false,
      status: chrome?.extensionInstalled === true ? "ok" : "not-configured",
      expected,
      found: chrome?.extensionInstalled === true ? "installed" : "not installed",
      detail: "Manual browser setup; do not install or open it automatically",
    });
  } catch {
    return finding({
      id: "chrome-extension",
      label: "Playwright Chrome extension",
      required: false,
      status: "unknown",
      expected,
      detail: "Playwright CLI returned an unexpected inventory",
    });
  }
}

function printHuman(report) {
  console.log(`Setup audit: ${report.root}`);
  for (const item of report.findings) {
    const scope = item.required ? "required" : "conditional";
    const found = item.found ? `; found ${item.found}` : "";
    console.log(`- ${item.status.toUpperCase()} [${scope}] ${item.label}${found}`);
    if (item.status !== "ok" && item.fix) console.log(`  fix: ${item.fix}`);
    if (item.status !== "ok" && item.detail) console.log(`  note: ${item.detail}`);
  }
  console.log(
    report.ok
      ? "Required setup is complete."
      : "Required setup is incomplete; install the listed items and re-run the audit.",
  );
}

const { values } = parseArgs({
  options: {
    root: { type: "string" },
    json: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (values.help) {
  console.log(usage());
  process.exit(0);
}

const root = findRepositoryRoot(values.root ?? process.cwd());
if (!root) {
  console.error(
    "Could not find this skills repository (expected Taskfile.yml, README.md, and the maintained skill directories).",
  );
  process.exit(2);
}

const findings = [];
const nodeVersion = process.versions.node;
const nodeComparison = compareVersions(nodeVersion, NODE_MINIMUM);
findings.push(
  finding({
    id: "node",
    label: "Node.js",
    status:
      nodeComparison !== null && nodeComparison >= 0 ? "ok" : "incompatible",
    expected: `>=${NODE_MINIMUM}`,
    found: nodeVersion,
    detail: process.execPath,
  }),
);

const npmPath = executableOnPath("npm");
findings.push(
  npmPath
    ? commandFinding({
        id: "npm",
        label: "npm",
        command: "npm",
        args: ["--version"],
        expected: "available with Node.js",
      })
    : finding({
        id: "npm",
        label: "npm",
        status: "missing",
        expected: "available with Node.js",
        detail: "Install npm with a supported Node.js distribution",
      }),
);

findings.push(
  commandFinding({
    id: "git",
    label: "Git",
    command: "git",
    args: ["--version"],
    expected: "available on PATH",
    fix: "Install Git with the platform's trusted package manager or installer",
  }),
  commandFinding({
    id: "task",
    label: "Task",
    command: "task",
    args: ["--version"],
    expected: "Task v3 CLI available on PATH",
    fix: "npm install -g @go-task/cli",
  }),
  commandFinding({
    id: "playwright-cli",
    label: "Playwright CLI",
    command: "playwright-cli",
    args: ["--version"],
    expected: PLAYWRIGHT_CLI_VERSION,
    accept: (value) => value.trim() === PLAYWRIGHT_CLI_VERSION,
    fix: `npm install -g @playwright/cli@${PLAYWRIGHT_CLI_VERSION}`,
  }),
);

const npmAvailable = Boolean(npmPath);
findings.push(localDependencies(root, npmAvailable));

const playwright = findings.find((item) => item.id === "playwright-cli");
findings.push(chromeExtensionFinding(playwright?.status === "ok"));

const report = {
  ok: findings.every((item) => !item.required || item.status === "ok"),
  root,
  requirements: {
    node: `>=${NODE_MINIMUM}`,
    playwrightCli: PLAYWRIGHT_CLI_VERSION,
  },
  findings,
};

if (values.json) console.log(JSON.stringify(report, null, 2));
else printHuman(report);

process.exitCode = report.ok ? 0 : 1;
