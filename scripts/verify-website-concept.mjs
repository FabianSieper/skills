#!/usr/bin/env node
// Browser-free wiring/document validation, not a production conformance audit.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const design = join(root, 'docs/strict-automation');
const skill = '.agents/skills/website-automation-builder/SKILL.md';
const errors = [];
let checkedLinks = 0;
const required = [skill, 'AGENTS.md', 'docs/strict-automation/concept.md',
  'docs/strict-automation/typescript-design.md', 'docs/strict-automation/navigation-design.md',
  'docs/strict-automation/migration.md', 'docs/strict-automation/todo.md'];
for (const path of required) {
  if (!existsSync(join(root, path))) errors.push(`Missing required file: ${path}`);
}
if (existsSync(join(root, 'skills/website-automation-builder/SKILL.md'))) {
  errors.push('The obsolete builder entrypoint still exists in skills/.');
}
if (existsSync(join(root, 'AGENTS.md')) &&
    !readFileSync(join(root, 'AGENTS.md'), 'utf8').includes(`](${skill})`)) {
  errors.push('AGENTS.md must link to the project-local builder.');
}
const docs = ['AGENTS.md', 'README.md', skill, '.agents/skills/setup/SKILL.md',
  '.agents/skills/setup/references/requirements.md'];
if (existsSync(design)) {
  docs.push(...readdirSync(design).filter(name => name.endsWith('.md'))
    .map(name => `docs/strict-automation/${name}`));
}
for (const path of docs) {
  if (!existsSync(join(root, path))) continue;
  const text = readFileSync(join(root, path), 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|#)/.test(target)) continue;
    checkedLinks++;
    if (!existsSync(resolve(dirname(join(root, path)), target.split('#')[0]))) {
      errors.push(`${path}: broken local link ${target}`);
    }
  }
}
for (const file of ['Taskfile.yml', '.github/workflows/test.yml']) {
  const text = readFileSync(join(root, file), 'utf8');
  if (text.includes('node skills/website-automation-builder/')) {
    errors.push(`${file}: invokes the removed builder`);
  }
}
const cardmarketTransportDocs = [
  'AGENTS.md',
  'README.md',
  skill,
  '.agents/skills/setup/SKILL.md',
  '.agents/skills/setup/references/requirements.md',
  'docs/strict-automation/todo.md',
  'docs/strict-automation/migration.md'
];
for (const path of cardmarketTransportDocs) {
  if (!existsSync(join(root, path))) continue;
  const text = readFileSync(join(root, path), 'utf8');
  if (!text.includes('munim-computer-use')) {
    errors.push(`${path}: missing the active Cardmarket transport reference`);
  }
  if (/mcp__cua_repl|Unified Computer Use/.test(text)) {
    errors.push(`${path}: stale Cardmarket transport reference`);
  }
}
console.log(JSON.stringify({ok: errors.length === 0, checkedLinks,
  scope: 'authoring-wiring-and-documents-only', errors}, null, 2));
process.exitCode = errors.length ? 1 : 0;
