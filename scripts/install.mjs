#!/usr/bin/env node
// Fresh-install the repository's Cardmarket skill into the agent-neutral global
// skills directory. This replaces the complete installed copy so no old CLI,
// package, browser-driver or runtime files survive.
//
// Usage: node scripts/install.mjs [target-dir]
// Default target: ~/.agents/skills/cardmarket-automation
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const repoRoot = resolve(import.meta.dirname, '..');
const source = resolve(repoRoot, 'skills/cardmarket-automation');
const target = resolve(process.argv[2] ?? join(homedir(), '.agents/skills/cardmarket-automation'));

const sourceStat = await stat(source).catch(() => null);
if (!sourceStat?.isDirectory()) {
  console.error(`source not found: ${source}`);
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

const copiedFiles = new Set();
async function walk(rel) {
  const entries = await readdir(join(source, rel), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name === '.local') continue;
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
await walk('');
console.log(`installed ${source} -> ${target}: copied ${copiedFiles.size} files`);
