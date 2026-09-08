import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function run(args:string[]){
  const result=spawnSync(process.execPath,['--experimental-strip-types','src/cli.ts',...args],
    {cwd:root,encoding:'utf8',timeout:10000});
  assert.equal(result.error,undefined);
  const lines=result.stdout.trim().split('\n');assert.equal(lines.length,1);
  return {status:result.status,json:JSON.parse(lines[0]!)};
}
test('list returns one JSON envelope without opening a browser',()=>{
  const result=run(['list']);assert.equal(result.status,0);assert.equal(result.json.ok,true);
});
test('invalid CLI flags return structured INVALID_INPUT',()=>{
  const result=run(['list','--typo']);assert.equal(result.status,2);
  assert.equal(result.json.error.code,'INVALID_INPUT');
});
test('run may omit an empty input file and reaches the browser prerequisite',()=>{
  const result=run(['run','info']);assert.notEqual(result.status,2);
  if (result.status === 0) {
    assert.equal(result.json.data.result.state, 'unknown');
    assert.equal(result.json.data.result.auth, null);
  } else {
    assert.ok(['BROWSER_REQUIRED','ATTACH_FAILED','AUTH_REQUIRED','UNKNOWN_STATE','CLI_PROTOCOL','TIMEOUT'].includes(result.json.error?.code));
  }
});
test('status is available as a browser-free command shape',()=>{
  const result=run(['status']);assert.notEqual(result.status,2);
  assert.ok(result.json.protocolVersion===1 || result.json.error?.code);
});
test('missing execute approval fails before a browser or write',()=>{
  const result=run(['execute']);assert.equal(result.status,3);
  assert.equal(result.json.error.code,'APPROVAL_REQUIRED');
});
test('unverified Cardmarket writes fail closed before browser access',()=>{
  const result=run(['plan','user.offer.update']);
  assert.equal(result.status,4);
  assert.equal(result.json.error.code,'NOT_VERIFIED');
  assert.equal(result.json.error.recovery.owner,'builder');
});
