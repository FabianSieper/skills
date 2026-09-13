#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const skillRoot = join(root, 'skills/cardmarket-automation');
const requiredFiles = [
  '.gitignore',
  'SKILL.md',
  'agents/openai.yaml',
  'references/transport.md',
  'references/flows.md',
  'references/selectors.md'
];
const errors = [];

function walk(directory, prefix = '') {
  const files = [];
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory() && ['.local', '.playwright-cli', 'node_modules'].includes(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

for (const file of requiredFiles) {
  if (!existsSync(join(skillRoot, file))) errors.push(`Missing required file: ${file}`);
}

const actualFiles = existsSync(skillRoot) ? walk(skillRoot).sort() : [];
for (const file of actualFiles) {
  if (!requiredFiles.includes(file)) errors.push(`Unexpected legacy/runtime file: ${file}`);
}

const activeText = requiredFiles
  .filter(file => file !== '.gitignore')
  .filter(file => existsSync(join(skillRoot, file)))
  .map(file => readFileSync(join(skillRoot, file), 'utf8'))
  .join('\n');
const skill = existsSync(join(skillRoot, 'SKILL.md'))
  ? readFileSync(join(skillRoot, 'SKILL.md'), 'utf8')
  : '';

const requirements = [
  ['munim-computer-use transport', /munim-computer-use/],
  ['required MCP tools', /munim-computer-use_\*/],
  ['hard stop when MCP is absent', /If they are missing, \*\*stop/],
  ['installation offer', /Offer to enable or configure it/],
  ['no automatic installation', /Do not enable or configure the MCP until the user accepts/],
  ['exact observation call', /munim-computer-use_get_app_state/],
  ['fresh state after interaction', /After every interaction, call\s+`munim-computer-use_get_app_state`/],
  ['single bound tab', /Keep the same tab for the task/],
  ['single Cardmarket tab', /Use exactly one Cardmarket tab/],
  ['no Enter search submission', /Never submit Cardmarket search forms with the Return\/Enter key/],
  ['durable writes disabled by default', /Durable Cardmarket writes are disabled by default/]
];
for (const [label, pattern] of requirements) {
  if (!pattern.test(skill)) errors.push(`SKILL.md lacks ${label}`);
}

for (const [label, pattern] of [
  ['playwright-cli instruction', /playwright-cli/i],
  ['legacy npm CLI instruction', /npm run cli/i],
  ['legacy source reference', /src\/(?:actions|pages|runtime)/i],
  ['legacy Unified Computer Use interface', /mcp__cua_repl|cua\.getState|getAXState|Unified Computer Use/]
]) {
  if (pattern.test(activeText)) errors.push(`Active Cardmarket files contain ${label}`);
}

const lineCount = skill.split('\n').length;
if (lineCount > 220) errors.push(`SKILL.md is not focused enough: ${lineCount} lines (max 220)`);

console.log(JSON.stringify({
  ok: errors.length === 0,
  transport: 'munim-computer-use',
  requiredTool: 'munim-computer-use',
  files: actualFiles,
  skillLines: lineCount,
  errors
}, null, 2));
process.exitCode = errors.length ? 1 : 0;