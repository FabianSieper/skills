import { parseArgs } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config } from '../site.config.ts';
import { actions } from './actions/index.ts';
import { actionContract } from './runtime/contracts.ts';
import { Engine, withLock } from './runtime/engine.ts';
import { implementationFingerprint } from './runtime/fingerprint.ts';
import { currentBrowserState, ensureAttached, invokeBrowser } from './runtime/cli-browser.ts';
import { AutomationError, normalizeError, exitCode, recoveryFor } from './runtime/errors.ts';
import { isStateId } from './types.ts';

process.umask(0o077);
const project = resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root = resolve(project,'.local');
const runId = randomUUID();
const started = Date.now();
let invokedAction: string | null = null;
let invokedPhase = 'parse';
let packageVersion = '0.0.0';
let implementationHash = '';
async function main(): Promise<unknown> {
  implementationHash = await implementationFingerprint(project);
  try { packageVersion = (JSON.parse(await readFile(join(project,'package.json'),'utf8')) as {version?:string}).version ?? packageVersion; } catch {}
  const runtimeConfig = {...config, implementationHash};
  const engine = new Engine(root, runtimeConfig, actions,
    (action, phase, input, preview) => invokeBrowser(project, root, action, phase, input, preview));
  const args = (() => {
    try { return parseArgs({options:{input:{type:'string'},json:{type:'string'},plan:{type:'string'},approve:{type:'string'}},
      strict:true,allowPositionals:true}); }
    catch { throw new AutomationError('INVALID_INPUT'); }
  })();
  const [command, id, ...extra] = args.positionals;
  invokedAction = typeof id === 'string' ? id : command === 'execute' ? (args.values.plan ?? null) : null;
  if (command === 'status') invokedAction = 'status';
  invokedPhase = command === 'plan' ? 'prepare' : command === 'execute' ? 'execute' : command === 'run' || command === 'status' ? 'run' : command ?? 'parse';
  const keys = Object.keys(args.values);
  function syntax(needsId: boolean, options: string[]): void {
    if (extra.length || (needsId ? !id : !!id) || keys.some(key => !options.includes(key)))
      throw new AutomationError('INVALID_INPUT');
  }
  async function input(): Promise<unknown> {
    const path = args.values.input;
    const inline = args.values.json;
    if (path && inline !== undefined) throw new AutomationError('INVALID_INPUT', 'input/json');
    if (!path && inline === undefined) return {};
    if (inline !== undefined) {
      if (Buffer.byteLength(inline) > config.maxInputBytes) throw new AutomationError('INVALID_INPUT', 'json-size');
      try { return JSON.parse(inline); } catch { throw new AutomationError('INVALID_INPUT', 'json'); }
    }
    if (typeof path !== 'string' || !path) throw new AutomationError('INVALID_INPUT');
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
      actions:actions.map(action => {
        const contract = actionContract(action.id);
        return {id:action.id,kind:action.kind,mode:contract?.mode ?? action.kind,description:action.description,
          ...(contract ? {from:contract.from,outcomes:contract.outcomes,auth:contract.auth,effects:contract.effects,
            enabled:contract.enabled,...(contract.disabledReason ? {disabledReason:contract.disabledReason} : {})} : {}),next:action.next};
      })};
    case 'describe': syntax(true,[]); return engine.describe(id!);
    case 'connect': syntax(false,[]); return withLock(root, runtimeConfig.lockStaleMs, async()=>{const browser = await ensureAttached('handoff');
      return {site:config.name,session:config.browser.session,attached:true,browserLaunch:false,browser};});
    case 'doctor': syntax(false,[]); return withLock(root, runtimeConfig.lockStaleMs, async()=>{const browser = await ensureAttached('handoff');
      return {site:config.name,session:config.browser.session,attached:true,configured:config.configured,browserLaunch:false,browser};});
    case 'status': syntax(false,[]); return engine.run('status',{});
    case 'run': syntax(true,['input','json']); return engine.run(id!,await input());
    case 'plan': syntax(true,['input','json']); return engine.plan(id!,await input());
    case 'execute': syntax(false,['plan','approve']);
      return engine.execute(args.values.plan ?? '',args.values.approve ?? '');
    default: throw new AutomationError('INVALID_INPUT');
  }
}
main().then(data => {
  process.stdout.write(JSON.stringify({protocolVersion:1,ok:true,runId,action:invokedAction,phase:invokedPhase,durationMs:Date.now()-started,version:packageVersion,implementationHash,browser:currentBrowserState(),data})+'\n');
}).catch(raw => {
  const error = normalizeError(raw);
  const recovery = recoveryFor(error.code);
  const context = error.context ?? {};
  const reportedState = isStateId(context.state) ? context.state : isStateId(context.actual) ? context.actual : null;
  process.stdout.write(JSON.stringify({ok:false,runId,durationMs:Date.now()-started,
    protocolVersion:1,action:invokedAction,phase:invokedPhase,state:reportedState,version:packageVersion,implementationHash,browser:currentBrowserState(),
    effects:{ui:error.code==='UNKNOWN_COMMIT'?'unknown':'none',commit:error.code==='UNKNOWN_COMMIT'?'unknown':'none'},
    availableActions:[],
    error:{code:error.code,message:error.message,...(error.step?{step:error.step}:{}),...context,
      recovery:context.recovery ?? recovery,retryable:false,
      mayHaveCommitted:error.code==='UNKNOWN_COMMIT'||error.code==='PLAN_USED'}})+'\n');
  process.exitCode=exitCode(error.code);
});
