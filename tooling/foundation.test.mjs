import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { checkFoundation, checkedPath, generatedFiles, loadFoundation, synchronize } from './foundation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'skill-foundation-'));
  cpSync(root, temporary, { recursive: true });
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  return temporary;
}
function modifyJson(root, relativePath, mutate) {
  const target = path.join(root, relativePath);
  const data = JSON.parse(readFileSync(target, 'utf8'));
  mutate(data);
  writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
}

test('seed integrity and specified case count', () => {
  const result = checkFoundation(root);
  assert.equal(result.status, 'pass');
  assert.equal(result.skills.length, 3);
  assert.equal(result.specified_cases, 38);
});
test('synchronization is idempotent', t => {
  const copy = fixture(t);
  assert.deepEqual(synchronize(copy, { write: true }), []);
});
test('dry run does not replace a changed generated reference', t => {
  const copy = fixture(t);
  const relative = 'skills/meta/create-skill/references/quality-standard.md';
  writeFileSync(path.join(copy, relative), 'changed\n');
  assert.ok(synchronize(copy).includes(relative));
  assert.equal(readFileSync(path.join(copy, relative), 'utf8'), 'changed\n');
  assert.throws(() => checkFoundation(copy), /Generated files differ/);
});
test('explicit regeneration updates both meta copies', t => {
  const copy = fixture(t);
  const source = path.join(copy, 'governance/quality-standard.md');
  writeFileSync(source, readFileSync(source, 'utf8') + '\nTest-only addition.\n');
  assert.equal(synchronize(copy, { write: true }).length, 2);
  assert.deepEqual(synchronize(copy), []);
});
test('missing local reference is rejected', t => {
  const copy = fixture(t);
  rmSync(path.join(copy, 'skills/coding/coding-conventions/references/examples.md'));
  assert.throws(() => checkFoundation(copy), /Missing reference/);
});
test('path traversal and absolute paths are rejected', () => {
  for (const candidate of ['../outside', '/etc/passwd', 'a/../b', 'a//b', 'C:\\tmp', 'a\0b']) {
    assert.throws(() => checkedPath(root, candidate), /Unsafe relative path/);
  }
});
test('symlink target is rejected without writing outside root', t => {
  const copy = fixture(t);
  const destination = path.join(copy, 'skills/meta/improve-skill/references/quality-standard.md');
  rmSync(destination);
  symlinkSync(path.join(root, 'governance/quality-standard.md'), destination);
  assert.throws(() => synchronize(copy, { write: true }), /Symlink refused/);
});
test('duplicate skill identities are rejected', t => {
  const copy = fixture(t);
  modifyJson(copy, 'foundation.json', data => data.skills.push(data.skills[0]));
  assert.throws(() => loadFoundation(copy), /Invalid or duplicate/);
});
test('generated mapping cannot write outside a skill resource directory', t => {
  const copy = fixture(t);
  modifyJson(copy, 'foundation.json', data => { data.shared_resources[0].target = '../../AGENTS.md'; });
  assert.throws(() => generatedFiles(copy), /Invalid resource mapping/);
});
test('changing an origin is detected and regeneration is explicit', t => {
  const copy = fixture(t);
  modifyJson(copy, 'skills/meta/create-skill/references/origin.json', data => { data.repository_id = 'forged'; });
  assert.throws(() => checkFoundation(copy), /Generated files differ/);
});
test('duplicate case ids are rejected', t => {
  const copy = fixture(t);
  modifyJson(copy, 'evaluations/cases/routing.json', data => { data.cases[1].id = data.cases[0].id; });
  assert.throws(() => checkFoundation(copy), /Invalid case/);
});
test('declaring a test passed inside its definition is rejected', t => {
  const copy = fixture(t);
  modifyJson(copy, 'evaluations/cases/regressions.json', data => { data.cases[0].initial_status = 'pass'; });
  assert.throws(() => checkFoundation(copy), /Invalid case/);
});
test('line budget is enforced', t => {
  const copy = fixture(t);
  const entry = path.join(copy, 'skills/coding/coding-conventions/SKILL.md');
  writeFileSync(entry, readFileSync(entry, 'utf8') + '\n'.repeat(510) + 'end\n');
  assert.throws(() => checkFoundation(copy), /line budget/);
});
