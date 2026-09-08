import { mkdir, open, readFile, stat, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Page } from 'playwright';
import { AutomationError } from './errors.ts';
import { digest, jsonValue, validateInput, type Fields, type Input, type Json } from './input.ts';
import { actionContract, availableActionIds, legalDestination, outcomeFor, validateContractRegistry } from './contracts.ts';
import { isStateId, type StateId } from '../types.ts';

export interface Preview { identity: Record<string, Json>; changes: Record<string, Json> }
interface Common {
  id: string;
  description: string;
  parameters: Fields;
  outputDescription: string;
  validateOutput: (value: unknown) => Json;
  modulePath: string;
  next: readonly string[];
}
export type Action = Common & (
  { kind: 'read'; run: (page: Page, input: Input) => Promise<unknown> } |
  { kind: 'write'; prepare: (page: Page, input: Input) => Promise<Preview>;
    execute: (page: Page, input: Input, preview: Preview) => Promise<unknown> }
);
export interface BrowserInvocation { accountKey: string; value: Json; state?: StateId }
export type BrowserExecutor = (action: Action, phase: 'run'|'prepare'|'execute', input: Input, preview?: Preview) => Promise<BrowserInvocation>;
export interface RuntimeConfig { name: string; version: number; planTtlMs: number; lockStaleMs: number; [key: string]: unknown }
interface Plan {
  format: 1; id: string; action: string; input: Input; accountKey: string;
  preview: Preview; configHash: string; createdAt: number; expiresAt: number;
}
async function privateDir(path: string): Promise<void> { await mkdir(path, { recursive: true, mode: 0o700 }); }
async function exclusiveJSON(path: string, data: unknown): Promise<void> {
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(data)); await handle.sync(); }
  finally { await handle.close(); }
}
function isExists(error: unknown): boolean { return (error as NodeJS.ErrnoException)?.code === 'EEXIST'; }
// A lock is stale when its owner is gone (dead pid, unparseable owner, or the lock
// outlived the generous bound). The age bound also covers pid reuse and hung owners.
async function isStaleLock(path: string, staleMs: number): Promise<boolean> {
  let raw: string;
  try { raw = await readFile(path, 'utf8'); } catch { return true; }
  let lock: { pid?: unknown; startedAt?: unknown };
  try { lock = JSON.parse(raw); } catch { return true; }
  const started = typeof lock.startedAt === 'string' ? Date.parse(lock.startedAt) : NaN;
  const age = Number.isFinite(started) ? Date.now() - started : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(age) || age > staleMs) return true;
  const pid = typeof lock.pid === 'number' ? lock.pid : null;
  if (pid === null) return false;
  try { process.kill(pid, 0); } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === 'ESRCH';
  }
  return false;
}
export async function withLock<T>(root: string, staleMs: number, job: () => Promise<T>): Promise<T> {
  await privateDir(root);
  const path = join(root, 'runtime.lock');
  const acquire = async (): Promise<boolean> => {
    try { await exclusiveJSON(path, { pid: process.pid, startedAt: new Date().toISOString() }); return true; }
    catch (error) { if (isExists(error)) return false; throw error; }
  };
  const run = async (): Promise<T> => { try { return await job(); } finally { await unlink(path); } };
  if (await acquire()) return await run();
  if (await isStaleLock(path, staleMs)) {
    await unlink(path).catch(() => {});
    if (!(await acquire())) throw new AutomationError('BUSY'); // another process won the reap race
    return await run();
  }
  throw new AutomationError('BUSY');
}
function validatePreview(raw: unknown): Preview {
  jsonValue(raw);
  const preview = raw as Preview;
  if (!preview || !preview.identity || !preview.changes || Array.isArray(preview.identity) ||
      Array.isArray(preview.changes) || !Object.keys(preview.identity).length || !Object.keys(preview.changes).length)
    throw new AutomationError('POSTCONDITION_FAILED');
  return preview;
}
export class Engine {
  readonly root: string; readonly config: RuntimeConfig; readonly actions: readonly Action[]; readonly browser: BrowserExecutor;
  constructor(root: string, config: RuntimeConfig, actions: readonly Action[], browser: BrowserExecutor) {
    this.root=root; this.config=config; this.actions=actions; this.browser=browser;
    const ids=actions.map(a=>a.id);
    if(new Set(ids).size!==ids.length || ids.some(id=>!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id)) ||
       actions.some(a=>!a.modulePath || !Array.isArray(a.next))) throw new AutomationError('NOT_CONFIGURED');
    const known = actions.map(action => Boolean(actionContract(action.id)));
    if (known.some(Boolean) && !known.every(Boolean)) throw new AutomationError('NOT_CONFIGURED', 'contract-registry');
    if (known.every(Boolean)) {
      try { validateContractRegistry(ids); }
      catch { throw new AutomationError('NOT_CONFIGURED', 'contract-registry'); }
    }
  }
  action(id:string):Action { const action=this.actions.find(a=>a.id===id); if(!action)throw new AutomationError('UNKNOWN_ACTION'); return action; }
  describe(id:string):object {
    const {id:action,kind,description,parameters,outputDescription,next}=this.action(id);
    const contract = actionContract(action);
    return contract
      ? {action,kind,mode:contract.mode,contractVersion:contract.contractVersion,description,parameters,outputDescription,
          from:contract.from,outcomes:contract.outcomes,auth:contract.auth,effects:contract.effects,
          enabled:contract.enabled,...(contract.disabledReason ? {disabledReason:contract.disabledReason} : {}),
          planPure:contract.planPure ?? true,next}
      : {action,kind,description,parameters,outputDescription,next};
  }
  private checkedResult(action: Action, invoked: BrowserInvocation): { result: Json; state?: StateId; outcome: string } {
    const result = jsonValue(action.validateOutput(invoked.value));
    const outcome = outcomeFor(result);
    if (result && typeof result === 'object' && !Array.isArray(result) &&
        (result as Record<string, Json>).status === 'wrong_state') {
      throw new AutomationError('WRONG_STATE', 'source-state', {
        expected: actionContract(action.id)?.from ?? [],
        actual: invoked.state ?? ((result as Record<string, Json>).state ?? 'unknown'),
        operation: action.id,
      });
    }
    const candidateValue = invoked.state ?? (result && typeof result === 'object' && !Array.isArray(result) &&
      typeof (result as Record<string, Json>).state === 'string' ? (result as Record<string, Json>).state : undefined);
    if (candidateValue !== undefined && !isStateId(candidateValue))
      throw new AutomationError('POSTCONDITION_FAILED', 'destination-state', { actual: candidateValue, operation: action.id });
    const candidate = candidateValue as StateId | undefined;
    const contract = actionContract(action.id);
    if (contract && candidate !== undefined && !legalDestination(contract, outcome, candidate))
      throw new AutomationError('POSTCONDITION_FAILED', 'destination-state', {
        expected: contract.outcomes[outcome] ?? [], actual: candidate, operation: action.id,
      });
    return { result, ...(candidate === undefined ? {} : { state: candidate }), outcome };
  }
  private next(action: Action, state: StateId | undefined, accountKey: string): readonly string[] {
    return state === undefined ? action.next : availableActionIds(state, accountKey);
  }
  /** Prefer the action's freshly returned auth fact over a stale transport key. */
  private accountKeyForResult(result: Json, fallback: string): string {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return fallback;
    const object = result as Record<string, Json>;
    if (object.authKnown === false) return 'unknown';
    const auth = object.auth;
    if (auth && typeof auth === 'object' && !Array.isArray(auth) && auth.loggedIn === false) return 'public';
    return fallback;
  }
  private availableDetails(ids: readonly string[]): Array<Record<string, Json>> {
    return ids.map((id) => {
      const action = this.action(id);
      const contract = actionContract(id);
      const required = Object.entries(action.parameters).filter(([, field]) => field.required).map(([name]) => name);
      const to: StateId[] = contract && contract.outcomes.ok ? [...contract.outcomes.ok] : [];
      const from: StateId[] = contract ? [...contract.from] : [];
      return {
        id,
        description: contract?.description ?? action.description,
        kind: action.kind,
        mode: contract?.mode ?? action.kind,
        auth: contract?.auth ?? 'public',
        from,
        to,
        effects: contract?.effects ?? { ui: 'unknown', commit: 'unknown' },
        requiredInput: required,
        commandPhase: action.kind === 'write' ? 'plan' : 'run',
      };
    });
  }
  async run(id:string,raw:unknown):Promise<unknown>{
    const action=this.action(id); if(action.kind!=='read')throw new AutomationError('APPROVAL_REQUIRED');
    const input=validateInput(action.parameters,raw);
    return withLock(this.root,this.config.lockStaleMs,async()=>{const invoked=await this.browser(action,'run',input);
      const checked = this.checkedResult(action, invoked);
      const accountKey = this.accountKeyForResult(checked.result, invoked.accountKey);
      const available = checked.state === undefined ? undefined : this.next(action, checked.state, accountKey);
      return {action:id,result:checked.result,allowedNextActions:available ?? this.next(action,checked.state,accountKey),
        ...(available === undefined ? {} : {state:checked.state,outcome:checked.outcome,
          availableActions:available,availableActionDetails:this.availableDetails(available)})};});
  }
  async plan(id:string,raw:unknown):Promise<unknown>{
    const action=this.action(id); const contract = actionContract(id);
    if(action.kind!=='write')throw new AutomationError('INVALID_INPUT');
    if (contract && !contract.enabled) throw new AutomationError('NOT_VERIFIED', 'contract-disabled', { operation: id, cause: contract.disabledReason });
    const input=validateInput(action.parameters,raw);
    return withLock(this.root,this.config.lockStaleMs,async()=>{const invoked=await this.browser(action,'prepare',input);
      const preview=validatePreview(invoked.value); const now=Date.now();
      const plan:Plan={format:1,id:randomUUID(),action:id,input,accountKey:invoked.accountKey,preview,
        configHash:digest(this.config),createdAt:now,expiresAt:now+this.config.planTtlMs};
      await privateDir(join(this.root,'plans')); await exclusiveJSON(join(this.root,'plans',plan.id+'.json'),plan);
      const state = invoked.state;
      const accountKey = this.accountKeyForResult(invoked.value, plan.accountKey);
      const available = state === undefined ? undefined : this.next(action, state, accountKey);
      return {action:id,planId:plan.id,approvalHash:digest(plan),accountKey:plan.accountKey,
        expiresAt:new Date(plan.expiresAt).toISOString(),preview,allowedNextActions:available ?? this.next(action,state,plan.accountKey),
        ...(available === undefined ? {} : {state,availableActions:available,availableActionDetails:this.availableDetails(available)}),
        instruction:'Review this exact plan and obtain user authorization before execute.'};});
  }
  async execute(id:string,approval:string):Promise<unknown>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)||!/^[0-9a-f]{64}$/.test(approval))
      throw new AutomationError('APPROVAL_REQUIRED');
    return withLock(this.root,this.config.lockStaleMs,async()=>{
      let plan:Plan; try{plan=JSON.parse(await readFile(join(this.root,'plans',id+'.json'),'utf8')) as Plan;}catch{throw new AutomationError('APPROVAL_REQUIRED');}
      if(digest(plan)!==approval||plan.format!==1||plan.id!==id)throw new AutomationError('APPROVAL_REQUIRED');
      const marker=join(this.root,'attempts',id+'.json');
      try{await stat(marker);throw new AutomationError('PLAN_USED');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      if(!Number.isFinite(plan.expiresAt)||Date.now()>=plan.expiresAt)throw new AutomationError('PLAN_EXPIRED');
      if(plan.configHash!==digest(this.config))throw new AutomationError('PLAN_CHANGED');
      const action=this.action(plan.action); const contract = actionContract(plan.action);
      if(action.kind!=='write')throw new AutomationError('PLAN_CHANGED');
      if (contract && !contract.enabled) throw new AutomationError('NOT_VERIFIED', 'contract-disabled', { operation: plan.action, cause: contract.disabledReason });
      const input=validateInput(action.parameters,plan.input); if(digest(input)!==digest(plan.input))throw new AutomationError('PLAN_CHANGED');
      const fresh=await this.browser(action,'prepare',input); const freshPreview=validatePreview(fresh.value);
      if(fresh.accountKey!==plan.accountKey||digest(freshPreview)!==digest(plan.preview))throw new AutomationError('PLAN_CHANGED');
      if(Date.now()>=plan.expiresAt)throw new AutomationError('PLAN_EXPIRED');
      await privateDir(join(this.root,'attempts'));
      try{await exclusiveJSON(marker,{planId:id,status:'started',at:Date.now()});}catch(error){if(isExists(error))throw new AutomationError('PLAN_USED');throw error;}
      try{
        const invoked=await this.browser(action,'execute',input,freshPreview);
        const checked = this.checkedResult(action, invoked);
        const result = checked.result;
        const temporary=marker+'.tmp'; await writeFile(temporary,JSON.stringify({planId:id,status:'completed',at:Date.now()}),{mode:0o600}); await rename(temporary,marker);
        const accountKey = this.accountKeyForResult(result, invoked.accountKey);
        const available = checked.state === undefined ? undefined : this.next(action, checked.state, accountKey);
        return {action:action.id,planId:id,result,allowedNextActions:available ?? this.next(action,checked.state,accountKey),
          ...(available === undefined ? {} : {state:checked.state,outcome:checked.outcome,
            availableActions:available,availableActionDetails:this.availableDetails(available)})};
      }catch(raw){
        const cause = raw instanceof AutomationError ? raw.code : raw instanceof Error ? raw.name : 'unknown';
        const context = raw instanceof AutomationError ? raw.context : undefined;
        throw new AutomationError('UNKNOWN_COMMIT', 'write-dispatch', {
          ...(context ?? {}), cause, operation: action.id,
        });
      }
    });
  }
}
