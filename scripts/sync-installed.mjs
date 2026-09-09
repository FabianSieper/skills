#!/usr/bin/env node
// Sync the repo's Cardmarket skill over the installed global copy so OpenCode's
// skill discovery never loads a stale build. Preserves the target's node_modules
// (owned by scripts/install-deps.mjs) and removes stale target entries.
//
// Usage: node scripts/sync-installed.mjs [target-dir]
// Default target: ~/.agents/skills/cardmarket-automation
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const EXCLUDE = new Set(['node_modules', '.local', '.playwright-cli', '.DS_Store']);
const repoRoot = resolve(import.meta.dirname, '..');
const source = resolve(repoRoot, 'skills/cardmarket-automation');
const target = resolve(process.argv[2] ?? join(homedir(), '.agents/skills/cardmarket-automation'));

const sourceStat = await stat(source).catch(() => null);
const targetStat = await stat(target).catch(() => null);
if (!sourceStat?.isDirectory()) { console.error(`source not found: ${source}`); process.exit(1); }
if (!targetStat?.isDirectory()) { console.error(`target not found (run 'task install:opencode' first): ${target}`); process.exit(1); }

const copiedFiles = new Set();
async function walk(rel) {
  const entries = await readdir(join(source, rel), { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.has(entry.name)) continue;
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    const srcPath = join(source, relPath);
    const dstPath = join(target, relPath);
    if (entry.isDirectory()) {
      await mkdir(dstPath, { recursive: true });
      await walk(relPath);
    } else if (entry.isFile()) {
      await cp(srcPath, dstPath);
      copiedFiles.add(relPath);
    }
  }
}

const sourceTop = new Set((await readdir(source, { withFileTypes: true })).filter(e => !EXCLUDE.has(e.name)).map(e => e.name));
let removedStale = 0;
for (const entry of await readdir(target, { withFileTypes: true })) {
  if (entry.name === 'node_modules' || !sourceTop.has(entry.name)) continue;
  await rm(join(target, entry.name), { recursive: true, force: true });
  removedStale += 1;
}

await walk('');
console.log(`synced ${source} -> ${target}: copied ${copiedFiles.size} files, removed ${removedStale} stale entries, node_modules preserved`);
