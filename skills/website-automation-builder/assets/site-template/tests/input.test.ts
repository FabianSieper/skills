import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, jsonValue, digest, type Fields } from '../src/runtime/input.ts';
import { AutomationError } from '../src/runtime/errors.ts';
const fields: Fields = {
  query:{type:'string',description:'Query',required:true,min:1,max:20},
  limit:{type:'integer',description:'Limit',default:10,min:1,max:20},
  active:{type:'boolean',description:'Active'},
  tags:{type:'string[]',description:'Tags',max:3},
  mode:{type:'string',description:'Mode',enum:['exact','prefix']}
};
function invalid(fn:()=>unknown): void {
  assert.throws(fn,(e:unknown)=>e instanceof AutomationError && e.code==='INVALID_INPUT');
}
test('input validates values and applies defaults without coercion',()=>{
  const result=validateInput(fields,{query:'ABC',active:false,tags:['x'],mode:'exact'});
  assert.equal(result.query,'ABC'); assert.equal(result.limit,10); assert.equal(result.active,false);
});
test('missing required field, unknown property and invalid types are rejected',()=>{
  for(const input of [{},{query:'ABC',extra:1},{query:'ABC',limit:'2'},{query:'ABC',limit:2.5},
    {query:''},{query:'ABC',limit:21},{query:'ABC',active:'true'}, {query:'ABC',tags:[1]},
    {query:'ABC',tags:['1','2','3','4']},{query:'ABC',mode:'fuzzy'},null,[]])
    invalid(()=>validateInput(fields,input));
});
test('prototype-looking unknown keys do not bypass input allowlist',()=>{
  invalid(()=>validateInput(fields,JSON.parse('{"query":"x","__proto__":{"x":1}}')));
  invalid(()=>validateInput(fields,JSON.parse('{"query":"x","constructor":"bad"}')));
});
test('canonical hashes are order independent but value sensitive',()=>{
  assert.equal(digest({b:2,a:1}),digest({a:1,b:2}));
  assert.notEqual(digest({a:1}),digest({a:'1'}));
});
test('non-JSON, non-finite values and cyclic outputs are rejected',()=>{
  const cyclic:Record<string,unknown>={};cyclic.self=cyclic;
  for(const value of [undefined,NaN,Infinity,new Date(),cyclic,{a:undefined}])
    assert.throws(()=>jsonValue(value),AutomationError);
});
