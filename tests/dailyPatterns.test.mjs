import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/_shared/dailyPatterns.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const { patternCandidates,dailyChecks }=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const record=(day,time,id='r'+day)=>({id,title:'Breakfast',savedAt:new Date(`2026-10-${day}T${time}:00+08:00`).toISOString()});
const p={id:'breakfast',title:'Breakfast',activity:'Breakfast',startMinute:540,endMinute:600,status:'confirmed'};
test('candidate timing statistics require repeated days, exclude private/future/current-day records and stay bounded',()=>{
 const records=[record(16,'09:15'),record(17,'09:30'),record(18,'09:15'),{...record(15,'01:00','private'),privateRecord:true},record(20,'04:00','future')];
 const candidates=patternCandidates(records,new Date('2026-10-20T00:00:00+08:00'),-480);
 assert.equal(candidates.length,1); assert.equal(candidates[0].days,3);assert.equal(candidates[0].count,3);assert.equal(candidates[0].startMinute,540);assert.equal(candidates[0].endMinute,585);
 assert.equal(patternCandidates(records.slice(0,2),new Date('2026-10-20T00:00:00+08:00'),-480).length,0);
});
test('a missing record creates a check at 75 percent of a confirmed window, and actual evidence resolves it',()=>{
 const at=time=>new Date(2026,9,19,...time.split(':').map(Number));
 const r={id:'today',title:'Breakfast recorded',savedAt:at('10:10').toISOString()};
 assert.equal(dailyChecks([p],[r],at('09:00'))[0].state,'upcoming');
 assert.equal(dailyChecks([p],[r],at('09:45'))[0].state,'check');
 assert.equal(dailyChecks([p],[r],at('10:15'))[0].state,'recorded');
 assert.equal(dailyChecks([{...p,status:'archived'}],[r],at('10:15')).length,0);
 assert.equal(dailyChecks([p],[{...r,privateRecord:true}],at('10:15'))[0].state,'check');
});
