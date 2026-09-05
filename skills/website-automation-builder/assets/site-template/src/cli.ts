import { parseArgs } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config } from '../site.config.ts';
import { actions } from './actions/index.ts';
import { Engine, withLock } from './runtime/engine.ts';
import { implementationFingerprint } from './runtime/fingerprint.ts';
import { ensureAttached, invokeBrowser } from './runtime/cli-browser.ts';
import { AutomationError, normalizeError, exitCode } from './runtime/errors.ts';

process.umask(0o077);
const project = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root = resolve(project,'.local');
const runId = randomUUID();
const started = Date.now();
async function main(): Promise<unknown> {
  const runtimeConfig = {...config, implementationHash:await implementationFingerprint(project)};
  const engine = new Engine(root, runtimeConfig, actions,
    (action, phase, input, preview) => invokeBrowser(project, root, action, phase, input, preview));
  const args = (() => {
    try { return parseArgs({options:{input:{type:'string'},plan:{type:'string'},approve:{type:'string'}},
      strict:true,allowPositionals:true}); }
    catch { throw new AutomationError('INVALID_INPUT'); }
  })();
  const [command, id, ...extra] = args.positionals;
  const keys = Object.keys(args.values);
  function syntax(needsId: boolean, options: string[]): void {
    if (extra.length || (needsId ? !id : !!id) || keys.some(key => !options.includes(key)))
      throw new AutomationError('INVALID_INPUT');
  }
  async function input(): Promise<unknown> {
    const path = args.values.input;
    if (!path) throw new AutomationError('INVALID_INPUT');
    try {
      const info = await stat(path);
      if (!info.isFile() || info.size > config.maxInputBytes) throw new Error('size');
      const data = await readFile(path,'utf8');
      if (Buffer.byteLength(data) > config.maxInputBytes) throw new Error('size');
      return JSON.parse(data);
    } catch { throw new AutomationError('INVALID_INPUT'); }
  }
  switch (command) {
    case 'list': syntax(false,[]); return {site:config.name, configured:config.configured,
      actions:actions.map(action => ({id:action.id,kind:action.kind,description:action.description,next:action.next}))};
    case 'describe': syntax(true,[]); return engine.describe(id!);
    case 'connect': syntax(false,[]); return withLock(root, async()=>{await ensureAttached();
      return {site:config.name,session:config.browser.session,attached:true,browserLaunch:false};});
    case 'doctor': syntax(false,[]); return withLock(root, async()=>{await ensureAttached();
      return {site:config.name,session:config.browser.session,attached:true,configured:config.configured,browserLaunch:false};});
    case 'run': syntax(true,['input']); return engine.run(id!,await input());
    case 'plan': syntax(true,['input']); return engine.plan(id!,await input());
    case 'execute': syntax(false,['plan','approve']);
      return engine.execute(args.values.plan ?? '',args.values.approve ?? '');
    default: throw new AutomationError('INVALID_INPUT');
  }
}
main().then(data => {
  process.stdout.write(JSON.stringify({ok:true,runId,durationMs:Date.now()-started,data})+'\n');
}).catch(raw => {
  const error = normalizeError(raw);
  process.stdout.write(JSON.stringify({ok:false,runId,durationMs:Date.now()-started,
    error:{code:error.code,message:error.message,...(error.step?{step:error.step}:{}),retryable:false,
      mayHaveCommitted:error.code==='UNKNOWN_COMMIT'||error.code==='PLAN_USED'}})+'\n');
  process.exitCode=exitCode(error.code);
});
