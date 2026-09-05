import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { Engine, withLock, type Action, type BrowserExecutor } from '../src/runtime/engine.ts';
import { AutomationError } from '../src/runtime/errors.ts';
import { digest, jsonValue } from '../src/runtime/input.ts';

type PlanResult={planId:string;approvalHash:string};
function code(expected:string) {return (e:unknown)=>e instanceof AutomationError && e.code===expected;}
async function fixture(job:(f:ReturnType<typeof make>)=>Promise<void>):Promise<void>{
  const root=await mkdtemp(join(tmpdir(),'website-engine-'));
  try {await job(make(root));} finally {await rm(root,{recursive:true,force:true});}
}
function make(root:string){
  const state={account:'account-a',revision:1,writes:0,throwAfter:false,badOutput:false};
  const modulePath='/fixture/action.ts';
  const actions:Action[]=[
    {id:'item.read',kind:'read',description:'Read',parameters:{},outputDescription:'Revision',modulePath,next:['item.update'],
      run:async()=>({revision:state.revision}),validateOutput:jsonValue},
    {id:'item.update',kind:'write',description:'Update',parameters:{
      value:{type:'integer',description:'New value',required:true,min:0,max:99}},outputDescription:'Updated value',modulePath,next:['item.read'],
      prepare:async(_,input)=>({identity:{targetId:'one',revision:state.revision},changes:{value:input.value!}}),
      execute:async(_,input)=>{state.writes++;if(state.throwAfter)throw new Error('lost');if(state.badOutput)return {value:undefined};return {value:input.value};},
      validateOutput:(value)=>{const raw=value as {value?:unknown};if(typeof raw.value!=='number')throw new AutomationError('POSTCONDITION_FAILED');return jsonValue(value);}}
  ];
  const browser:BrowserExecutor=async(action,phase,input,preview)=>{
    if(action.id==='item.read'&&phase==='run')return {accountKey:state.account,value:await action.run({} as Page,input) as never};
    if(action.kind!=='write')throw new Error('fixture');
    if(phase==='prepare')return {accountKey:state.account,value:await action.prepare({} as Page,input) as never};
    if(phase==='execute')return {accountKey:state.account,value:await action.execute({} as Page,input,preview!) as never};
    throw new Error('fixture');
  };
  const config={name:'fixture',version:1,planTtlMs:600000};
  const engine=new Engine(root,config,actions,browser);
  return {root,state,actions,browser,config,engine,plan:async()=>await engine.plan('item.update',{value:7}) as PlanResult};
}
test('describe contract and read action include next actions',()=>fixture(async f=>{
  assert.deepEqual((f.engine.describe('item.read') as {next:string[]}).next,['item.update']);
  assert.deepEqual(await f.engine.run('item.read',{}),{action:'item.read',result:{revision:1},allowedNextActions:['item.update']});
  await assert.rejects(()=>f.engine.run('unknown',{}),code('UNKNOWN_ACTION'));
}));
test('write cannot run through read command; preview makes no mutation',()=>fixture(async f=>{
  await assert.rejects(()=>f.engine.run('item.update',{value:7}),code('APPROVAL_REQUIRED'));
  const p=await f.plan();assert.ok(p.planId);assert.equal(f.state.writes,0);
}));
test('changed account or target revision blocks execution',()=>fixture(async f=>{
  const p=await f.plan();f.state.account='account-b';await assert.rejects(()=>f.engine.execute(p.planId,p.approvalHash),code('PLAN_CHANGED'));
  f.state.account='account-a';f.state.revision++;await assert.rejects(()=>f.engine.execute(p.planId,p.approvalHash),code('PLAN_CHANGED'));assert.equal(f.state.writes,0);
}));
test('successful write is verified and cannot be replayed',()=>fixture(async f=>{
  const p=await f.plan();const result=await f.engine.execute(p.planId,p.approvalHash) as {allowedNextActions:string[]};
  assert.equal(f.state.writes,1);assert.deepEqual(result.allowedNextActions,['item.read']);
  await assert.rejects(()=>f.engine.execute(p.planId,p.approvalHash),code('PLAN_USED'));
}));
test('lost response after write becomes UNKNOWN_COMMIT and blocks replay',()=>fixture(async f=>{
  const p=await f.plan();f.state.throwAfter=true;await assert.rejects(()=>f.engine.execute(p.planId,p.approvalHash),code('UNKNOWN_COMMIT'));
  assert.equal(f.state.writes,1);await assert.rejects(()=>f.engine.execute(p.planId,p.approvalHash),code('PLAN_USED'));
}));
test('invalid result after a write is UNKNOWN_COMMIT',()=>fixture(async f=>{
  const p=await f.plan();f.state.badOutput=true;await assert.rejects(()=>f.engine.execute(p.planId,p.approvalHash),code('UNKNOWN_COMMIT'));
}));
test('changed implementation blocks execution',()=>fixture(async f=>{
  const p=await f.plan();f.config.version++;await assert.rejects(()=>f.engine.execute(p.planId,p.approvalHash),code('PLAN_CHANGED'));
}));
test('expired unused plan blocks execution',()=>fixture(async f=>{
  f.config.planTtlMs=-1;const p=await f.plan();await assert.rejects(()=>f.engine.execute(p.planId,p.approvalHash),code('PLAN_EXPIRED'));assert.equal(f.state.writes,0);
}));
test('used plan is never mistaken for an unused expired plan',()=>fixture(async f=>{
  const p=await f.plan();await f.engine.execute(p.planId,p.approvalHash);const path=join(f.root,'plans',p.planId+'.json');
  const saved=JSON.parse(await readFile(path,'utf8'));saved.expiresAt=0;await writeFile(path,JSON.stringify(saved));
  await assert.rejects(()=>f.engine.execute(p.planId,digest(saved)),code('PLAN_USED'));
}));
test('concurrent run is blocked by project lock',()=>fixture(async f=>{
  await withLock(f.root,async()=>{await assert.rejects(()=>f.engine.run('item.read',{}),code('BUSY'));});await f.engine.run('item.read',{});
}));
