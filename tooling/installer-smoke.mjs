import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadFoundation } from './foundation.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installerEntry = process.argv[2];
if (!installerEntry || process.argv.length !== 3) {
  console.error('Aufruf: node tooling/installer-smoke.mjs /pfad/zu/skills/bin/cli.mjs');
  process.exit(2);
}
const installerPath = realpathSync(installerEntry);
const config = loadFoundation(sourceRoot);
const sandbox = realpathSync(mkdtempSync(path.join(tmpdir(), 'foundation-installer-')));

function fingerprints(directory) {
  const result = {};
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Unerwarteter Symlink: ${entry.name}`);
    if (entry.isDirectory()) {
      for (const [relative, digest] of Object.entries(fingerprints(target))) {
        result[`${entry.name}/${relative}`] = digest;
      }
    } else if (entry.isFile()) {
      result[entry.name] = createHash('sha256').update(readFileSync(target)).digest('hex');
    } else {
      assert.fail(`Unerwarteter Dateityp: ${entry.name}`);
    }
  }
  return result;
}

function isolatedEnvironment(label) {
  const root = path.join(sandbox, label);
  for (const directory of ['home', 'config', 'state', 'cache', 'codex', 'tmp', 'project']) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  // Kein geerbter Token, Agenten-Home oder XDG-Pfad darf in die Testinstallation gelangen.
  const env = {
    PATH: process.env.PATH,
    HOME: path.join(root, 'home'),
    XDG_CONFIG_HOME: path.join(root, 'config'),
    XDG_STATE_HOME: path.join(root, 'state'),
    XDG_CACHE_HOME: path.join(root, 'cache'),
    CODEX_HOME: path.join(root, 'codex'),
    TMPDIR: path.join(root, 'tmp'),
    DO_NOT_TRACK: '1', DISABLE_TELEMETRY: '1', NODE_DISABLE_COMPILE_CACHE: '1', CI: 'true',
  };
  function run(args) {
    const result = spawnSync(process.execPath, [installerPath, ...args], {
      env, cwd: path.join(root, 'project'), encoding: 'utf8', timeout: 45000, maxBuffer: 2 ** 20,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Installer fehlgeschlagen: ${result.stderr}\n${result.stdout}`);
    return result.stdout;
  }
  return { root, run };
}

const original = new Map(config.skills.map(skill => [skill.id, fingerprints(path.join(sourceRoot, skill.path))]));
const discovery = isolatedEnvironment('discovery');
assert.equal(discovery.run(['--version']).trim(), '1.7.1', 'Gepinnte CLI-Version erforderlich');
const list = discovery.run(['add', sourceRoot, '--list']);
for (const skill of config.skills) assert(list.includes(skill.id), `Nicht erkannt: ${skill.id}`);
assert(!existsSync(path.join(discovery.root, 'home', '.agents', 'skills')), 'List darf nicht installieren');

const results = [];
for (const [label, ids, copy] of [
  ['default', config.skills.map(skill => skill.id), false],
  ['copy', config.skills.map(skill => skill.id), true],
  ['selected', ['create-skill'], false],
]) {
  const environment = isolatedEnvironment(label);
  const args = ['add', sourceRoot, '-g', '-a', 'codex', '-a', 'github-copilot', '-a', 'opencode'];
  for (const id of ids) args.push('--skill', id);
  if (copy) args.push('--copy');
  environment.run([...args, '-y']);
  const installedRoot = path.join(environment.root, 'home', '.agents', 'skills');
  assert.deepEqual(readdirSync(installedRoot).sort(), [...ids].sort());
  for (const id of ids) {
    const installed = path.join(installedRoot, id);
    assert(!lstatSync(installed).isSymbolicLink(), 'Diese universellen Agentenziele verwenden eine gemeinsame Kopie');
    assert.deepEqual(fingerprints(installed), original.get(id), `Unvollständiges Paket: ${id}`);
    assert(realpathSync(installed).startsWith(environment.root + path.sep));
    assert.notEqual(realpathSync(installed), path.join(sourceRoot, config.skills.find(skill => skill.id === id).path));
  }
  results.push({ case: label, status: 'pass', selected_skills: ids, installation: 'shared-copy', resources: 'byte-identical' });
}
for (const skill of config.skills) assert.deepEqual(fingerprints(path.join(sourceRoot, skill.path)), original.get(skill.id));
console.log(JSON.stringify({
  date: '2026-10-09', node_version: process.version, installer_version: '1.7.1', source_kind: 'local-checkout',
  discovery: 'pass', cases: results, source_unchanged: true,
  agent_session_recognition: 'not-run', github_updates: 'not-run',
  scope: 'Lokale Installer-Paketprüfung; keine Agenten-/Modell- oder Rechteprüfung',
}, null, 2));
