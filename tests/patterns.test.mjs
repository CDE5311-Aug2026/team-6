import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const compile = s => ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const core = await import('data:text/javascript;base64,'+Buffer.from(compile(readFileSync(new URL('../supabase/functions/patterns-ai/core.ts',import.meta.url),'utf8'))).toString('base64'));
const now=Date.parse('2026-10-15T18:00:00Z');
const records=Array.from({length:7},(_,i)=>({id:'r'+i,savedAt:`2026-10-${String(i+9).padStart(2,'0')}T01:00:00Z`,title:'Breakfast',note:'Ate breakfast calmly.'}));
test('seven distinct consecutive local dates required; gaps, duplicates, private and future records do not qualify',()=>{
 assert.equal(core.patternWindow(records,now).eligible,true);
 assert.equal(core.patternWindow(Array(20).fill(records[0]),now).streak,1);
 assert.equal(core.patternWindow(records.filter((_,i)=>i!==3),now).streak,3);
 assert.equal(core.patternWindow(records.map((r,i)=>({...r,privateRecord:i===3})),now).eligible,false);
 assert.equal(core.patternWindow([...records.slice(0,6),{...records[6],savedAt:'2099-01-01'}],now).eligible,false);
 assert.equal(core.patternWindow([{...records[0],savedAt:'invalid'}],now).streak,0);
 const boundary=core.patternWindow([{...records[0],savedAt:'2026-10-09T15:59:59Z'},{...records[1],savedAt:'2026-10-09T16:00:00Z'}],now);
 assert.deepEqual(boundary.dates,['2026-10-09','2026-10-10']);
});
test('fingerprint stable on reordering and image changes; changes for observation edits',async()=>{
 const hash=rs=>core.patternFingerprint(core.patternWindow(rs,now).records);
 assert.equal(await hash(records),await hash([...records].reverse().map(r=>({...r,image:'blob:another'}))));
 assert.notEqual(await hash(records),await hash(records.map((r,i)=>i? r:{...r,note:'Changed'})));
});
test('AI evidence must cite real observations across at least three dates; incomplete output rejected',()=>{
 const body=p=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({patterns:p})}]}]});
 const p={title:'Calm breakfasts',detail:'Usually calm at breakfast.',evidence:'Observed on three dates.',recordIds:['r0','r1','r2']};
 assert.equal(core.parsePatterns(body([p]),records).length,1);
 assert.throws(()=>core.parsePatterns(body([{...p,recordIds:['r0','invented']}]),records));
 assert.throws(()=>core.parsePatterns(body([{...p,recordIds:['r0','r1']}]),records));
 assert.throws(()=>core.parsePatterns({...body([p]),status:'incomplete'},records));
 assert.deepEqual(core.parsePatterns(body([]),records),[]);
});
async function handler({owned=true, observations=records, quota=true}={}) {
 let serve;let calls=0;const fingerprint=await core.patternFingerprint(core.patternWindow(observations).records);
 const payload={accounts:[{id:'owner',pets:owned?[{id:'pet',workspace:{observations}}]:[]}]};
 const admin={
   auth:{getUser:async token=>({data:{user:token==='valid'?{id:'owner'}:null}})},
   from:()=>({select:()=>({eq:(key,id)=>{assert.equal(key,'user_id');assert.equal(id,'owner');return {maybeSingle:async()=>({data:{payload}})};}})}),
   rpc:async()=>({data:quota})
 };

 const raw=readFileSync(new URL('../supabase/functions/patterns-ai/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(compile(raw),{...core,createClient:()=>admin,Deno:{env:{get:()=> 'test-only'},serve:fn=>serve=fn},Response,Request,AbortSignal,Uint8Array,TextDecoder,fetch:async()=>{calls++;return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:'{"patterns":[]}'}]}]}));}});
 return {send:(token='valid',fp=fingerprint)=>serve(new Request('https://example',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({petId:'pet',fingerprint:fp})})),calls:()=>calls};
}
test('server enforces ownership, seven days, sync fingerprint and quota before any paid call',async()=>{
 for(const [options,status] of [[{owned:false},404],[{observations:records.slice(1)},422],[{quota:false},429]]) {const app=await handler(options);assert.equal((await app.send()).status,status);assert.equal(app.calls(),0);}
 const app=await handler();assert.equal((await app.send('invalid')).status,401);assert.equal((await app.send('valid','stale')).status,409);assert.equal(app.calls(),0);
 assert.equal((await app.send()).status,200);assert.equal(app.calls(),1);
});
