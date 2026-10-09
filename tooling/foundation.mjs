import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Refuse traversal and symlinks; this is not an operating-system sandbox. */
export function checkedPath(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 ||
      /[\\:\0]/u.test(relativePath) || path.posix.isAbsolute(relativePath) ||
      relativePath.split('/').some(part => part === '' || part === '.' || part === '..')) {
    throw new Error(`Unsafe relative path: ${String(relativePath)}`);
  }
  const base = realpathSync(root);
  let cursor = base;
  for (const part of relativePath.split('/')) {
    cursor = path.join(cursor, part);
    try {
      if (lstatSync(cursor).isSymbolicLink()) throw new Error(`Symlink refused: ${relativePath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return cursor;
}

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(checkedPath(root, relativePath), 'utf8'));
}

export function loadFoundation(root = moduleRoot) {
  const config = readJson(root, 'foundation.json');
  if (config.schema_version !== 1 || !Array.isArray(config.skills) || config.skills.length === 0 ||
      typeof config.repository_id !== 'string' || !config.repository_id.startsWith('urn:uuid:') ||
      typeof config.foundation_version !== 'string' ||
      !(config.canonical_source === null || typeof config.canonical_source === 'string')) {
    throw new Error('Invalid foundation.json shape.');
  }
  const ids = new Set();
  for (const skill of config.skills) {
    if (!validName.test(skill.id) || !validName.test(skill.category) || ids.has(skill.id) ||
        skill.path !== `skills/${skill.category}/${skill.id}` ||
        !['foundation', 'normal'].includes(skill.review_class)) {
      throw new Error(`Invalid or duplicate skill entry: ${JSON.stringify(skill)}`);
    }
    ids.add(skill.id);
    checkedPath(root, skill.path);
  }
  for (const group of ['shared_resources', 'create_resources']) {
    if (!Array.isArray(config[group])) throw new Error(`Missing ${group}.`);
    for (const resource of config[group]) {
      checkedPath(root, resource.source);
      if (!/^(governance|templates)\/[a-z0-9-]+\.md$/u.test(resource.source) ||
          !/^(references|assets)\/[a-z0-9-]+\.md$/u.test(resource.target)) {
        throw new Error(`Invalid resource mapping: ${JSON.stringify(resource)}`);
      }
    }
  }
  return config;
}

/** Build deterministic copies; never infer repository trust from these files. */
export function generatedFiles(root = moduleRoot) {
  const config = loadFoundation(root);
  const plan = new Map();
  function add(relativePath, content) {
    checkedPath(root, relativePath);
    if (plan.has(relativePath)) throw new Error(`Duplicate generated target: ${relativePath}`);
    plan.set(relativePath, content);
  }
  for (const skill of config.skills) {
    const resources = skill.category === 'meta' ? [...config.shared_resources] : [];
    if (skill.id === 'create-skill') resources.push(...config.create_resources);
    for (const resource of resources) {
      const sourceText = readFileSync(checkedPath(root, resource.source), 'utf8');
      add(`${skill.path}/${resource.target}`,
        `<!-- GENERATED from ${resource.source}; edit the canonical source, not this copy. -->\n\n${sourceText}`);
    }
    add(`${skill.path}/references/origin.json`, JSON.stringify({
      schema_version: 1,
      generated: true,
      repository_id: config.repository_id,
      canonical_source: config.canonical_source,
      skill_id: skill.id,
      source_path: skill.path,
      foundation_version: config.foundation_version
    }, null, 2) + '\n');
  }
  return plan;
}

export function synchronize(root = moduleRoot, { write = false } = {}) {
  const differences = [];
  for (const [relativePath, expected] of generatedFiles(root)) {
    const destination = checkedPath(root, relativePath);
    const actual = existsSync(destination) ? readFileSync(destination, 'utf8') : null;
    if (actual === expected) continue;
    differences.push(relativePath);
    if (!write) continue;
    mkdirSync(path.dirname(destination), { recursive: true });
    checkedPath(root, relativePath);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, expected, { encoding: 'utf8', flag: 'wx' });
      renameSync(temporary, destination);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
  return differences;
}

function validateCases(root, config) {
  const ids = new Set();
  const skills = new Set(config.skills.map(skill => skill.id));
  let count = 0;
  for (const relativePath of ['evaluations/cases/regressions.json', 'evaluations/cases/routing.json']) {
    const data = readJson(root, relativePath);
    if (data.schema_version !== 1 || !Array.isArray(data.cases)) throw new Error(`Invalid cases: ${relativePath}`);
    for (const entry of data.cases) {
      if (typeof entry.id !== 'string' || ids.has(entry.id) ||
          typeof entry.input?.user !== 'string' || entry.input.user.length === 0 ||
          typeof entry.input.context !== 'string' || entry.initial_status !== 'not-run') {
        throw new Error(`Invalid case: ${String(entry.id)}`);
      }
      if (relativePath.endsWith('regressions.json')) {
        if (!(skills.has(entry.target_skill) || (entry.target_skill === null && entry.layer === 'integration')) ||
            !['behavior', 'integration'].includes(entry.layer) || typeof entry.critical !== 'boolean' ||
            !Array.isArray(entry.expected?.must) || entry.expected.must.length === 0 ||
            !Array.isArray(entry.expected.must_not) || entry.expected.must_not.length === 0 ||
            ![...entry.expected.must, ...entry.expected.must_not].every(item => typeof item === 'string' && item.length > 0)) {
          throw new Error(`Invalid regression criteria: ${entry.id}`);
        }
      } else if (!(entry.expected_initial_skill === null || skills.has(entry.expected_initial_skill))) {
        throw new Error(`Invalid routing target: ${entry.id}`);
      }
      ids.add(entry.id);
      count += 1;
    }
  }
  return count;
}

/** Checks this seed's local file integrity, not YAML semantics or model behavior. */
export function checkFoundation(root = moduleRoot) {
  const config = loadFoundation(root);
  const stale = synchronize(root);
  if (stale.length) throw new Error(`Generated files differ: ${stale.join(', ')}`);
  const stats = [];
  for (const skill of config.skills) {
    const skillRoot = checkedPath(root, skill.path);
    const text = readFileSync(checkedPath(skillRoot, 'SKILL.md'), 'utf8');
    const lines = text.trimEnd().split('\n').length;
    if (lines >= 500) throw new Error(`SKILL.md exceeds line budget: ${skill.id}`);
    // Deliberately limited to inline local links used by these hand-authored entrypoints.
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/gu)) {
      if (/^(https?:|#)/u.test(match[1])) continue;
      const target = checkedPath(skillRoot, match[1]);
      if (!existsSync(target) || !lstatSync(target).isFile()) throw new Error(`Missing reference: ${skill.id}/${match[1]}`);
    }
    stats.push({ skill_id: skill.id, words: text.trim().split(/\s+/u).length, lines,
      sha256: createHash('sha256').update(text).digest('hex') });
  }
  return { status: 'pass', scope: 'local-reference-integrity-only', skills: stats, specified_cases: validateCases(root, config) };
}

function main(args) {
  const [command = 'check', ...flags] = args;
  if (command === 'check' && flags.length === 0) {
    console.log(JSON.stringify(checkFoundation(), null, 2));
  } else if (command === 'sync' && (flags.length === 0 || (flags.length === 1 && flags[0] === '--write'))) {
    const write = flags.includes('--write');
    console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', changed: synchronize(moduleRoot, { write }) }, null, 2));
  } else {
    throw new Error('Usage: node tooling/foundation.mjs check | sync [--write]');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
