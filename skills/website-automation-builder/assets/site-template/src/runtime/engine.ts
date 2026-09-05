import { mkdir, open, readFile, stat, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Page } from 'playwright';
import { AutomationError } from './errors.ts';
import { digest, jsonValue, validateInput, type Fields, type Input, type Json } from './input.ts';

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
export interface BrowserInvocation { accountKey: string; value: Json }
export type BrowserExecutor = (action: Action, phase: 'run'|'prepare'|'execute', input: Input, preview?: Preview) => Promise<BrowserInvocation>;
export interface RuntimeConfig { name: string; version: number; planTtlMs: number; [key: string]: unknown }
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
export async function withLock<T>(root: string, job: () => Promise<T>): Promise<T> {
  await privateDir(root);
  const path = join(root, 'runtime.lock');
  try { await exclusiveJSON(path, {pid: process.pid, startedAt: new Date().toISOString()}); }
  catch (error) { if (isExists(error)) throw new AutomationError('BUSY'); throw error; }
  try { return await job(); } finally { await unlink(path); }
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
  }
  action(id:string):Action { const action=this.actions.find(a=>a.id===id); if(!action)throw new AutomationError('UNKNOWN_ACTION'); return action; }
  describe(id:string):object { const {id:action,kind,description,parameters,outputDescription,next}=this.action(id); return {action,kind,description,parameters,outputDescription,next}; }
  async run(id:string,raw:unknown):Promise<unknown>{
    const action=this.action(id); if(action.kind!=='read')throw new AutomationError('APPROVAL_REQUIRED');
    const input=validateInput(action.parameters,raw);
    return withLock(this.root,async()=>{const invoked=await this.browser(action,'run',input);
      return {action:id,result:jsonValue(action.validateOutput(invoked.value)),allowedNextActions:action.next};});
  }
  async plan(id:string,raw:unknown):Promise<unknown>{
    const action=this.action(id); if(action.kind!=='write')throw new AutomationError('INVALID_INPUT');
    const input=validateInput(action.parameters,raw);
    return withLock(this.root,async()=>{const invoked=await this.browser(action,'prepare',input);
      const preview=validatePreview(invoked.value); const now=Date.now();
      const plan:Plan={format:1,id:randomUUID(),action:id,input,accountKey:invoked.accountKey,preview,
        configHash:digest(this.config),createdAt:now,expiresAt:now+this.config.planTtlMs};
      await privateDir(join(this.root,'plans')); await exclusiveJSON(join(this.root,'plans',plan.id+'.json'),plan);
      return {action:id,planId:plan.id,approvalHash:digest(plan),accountKey:plan.accountKey,
        expiresAt:new Date(plan.expiresAt).toISOString(),preview,allowedNextActions:action.next,
        instruction:'Review this exact plan and obtain user authorization before execute.'};});
  }
  async execute(id:string,approval:string):Promise<unknown>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)||!/^[0-9a-f]{64}$/.test(approval))
      throw new AutomationError('APPROVAL_REQUIRED');
    return withLock(this.root,async()=>{
      let plan:Plan; try{plan=JSON.parse(await readFile(join(this.root,'plans',id+'.json'),'utf8')) as Plan;}catch{throw new AutomationError('APPROVAL_REQUIRED');}
      if(digest(plan)!==approval||plan.format!==1||plan.id!==id)throw new AutomationError('APPROVAL_REQUIRED');
      const marker=join(this.root,'attempts',id+'.json');
      try{await stat(marker);throw new AutomationError('PLAN_USED');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      if(!Number.isFinite(plan.expiresAt)||Date.now()>=plan.expiresAt)throw new AutomationError('PLAN_EXPIRED');
      if(plan.configHash!==digest(this.config))throw new AutomationError('PLAN_CHANGED');
      const action=this.action(plan.action); if(action.kind!=='write')throw new AutomationError('PLAN_CHANGED');
      const input=validateInput(action.parameters,plan.input); if(digest(input)!==digest(plan.input))throw new AutomationError('PLAN_CHANGED');
      const fresh=await this.browser(action,'prepare',input); const freshPreview=validatePreview(fresh.value);
      if(fresh.accountKey!==plan.accountKey||digest(freshPreview)!==digest(plan.preview))throw new AutomationError('PLAN_CHANGED');
      if(Date.now()>=plan.expiresAt)throw new AutomationError('PLAN_EXPIRED');
      await privateDir(join(this.root,'attempts'));
      try{await exclusiveJSON(marker,{planId:id,status:'started',at:Date.now()});}catch(error){if(isExists(error))throw new AutomationError('PLAN_USED');throw error;}
      try{
        const invoked=await this.browser(action,'execute',input,freshPreview);
        const result=jsonValue(action.validateOutput(invoked.value));
        const temporary=marker+'.tmp'; await writeFile(temporary,JSON.stringify({planId:id,status:'completed',at:Date.now()}),{mode:0o600}); await rename(temporary,marker);
        return {action:action.id,planId:id,result,allowedNextActions:action.next};
      }catch{throw new AutomationError('UNKNOWN_COMMIT');}
    });
  }
}
