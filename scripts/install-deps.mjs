#!/usr/bin/env node
// Install npm dependencies for installed skill copies. The `skills add`
// installer copies skill directories without node_modules, leaving skills
// with a package.json unusable until their dependencies are installed.
//
// Usage: node scripts/install-deps.mjs [skills-root]
// Default root: ~/.agents/skills
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const execFileAsync = promisify(execFile);

const root = process.argv[2] ?? join(homedir(), '.agents', 'skills');
if (!existsSync(root)) {
  console.log(`install-deps: no skills root at ${root}, nothing to do`);
  process.exit(0);
}
for (const name of readdirSync(root)) {
  const dir = join(root, name);
  if (!existsSync(join(dir, 'package.json'))) continue;
  if (existsSync(join(dir, 'node_modules'))) {
    console.log(`install-deps: ${name} already has node_modules, skipping`);
    continue;
  }
  console.log(`install-deps: ${name} -> npm install`);
  try {
    await execFileAsync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, maxBuffer: 16 * 1024 * 1024 });
    console.log(`install-deps: ${name} done`);
  } catch (error) {
    console.error(`install-deps: ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
