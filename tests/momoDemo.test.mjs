import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pet=JSON.parse(readFileSync(new URL('../fixtures/momo-demo-week.json',import.meta.url),'utf8'));
test('Momo starter records have one distinct public demo photo per observation',()=>{
 const events=pet.workspace.observations;
 assert.equal(events.length,50);assert.equal(new Set(events.map(o=>o.id)).size,50);
 assert.equal(new Set(events.map(o=>o.image)).size,50);
 assert.ok(!events.some(o=>o.image===pet.avatar));
 for(const o of events){
  assert.equal(o.synthetic,true);
  assert.match(o.image,/^https:\/\/efihvahumvqyaumdqpcy\.supabase\.co\/storage\/v1\/object\/public\/pawsona-demo\/momo-v2\/[^/]+\.jpg$/);
  assert.match(o.note,/Demo record\./);assert.match(o.note,/AI-generated illustration/);
  assert.ok(!/[\u4e00-\u9fff]/u.test(o.title+o.note+o.context));
 }
});
test('Momo daily totals agree with the timestamped records and preserve the camera gap',()=>{
 assert.equal(pet.testData.dailySummaries.length,7);
 assert.equal(new Set(pet.workspace.observations.map(o=>o.observedAt.slice(0,10))).size,7);
 for(const d of pet.testData.dailySummaries){
  const records=pet.workspace.observations.filter(o=>o.observedAt.startsWith(d.date));
  assert.equal(d.totalWalkMinutes,records.filter(o=>o.observationKind==='walk').reduce((n,o)=>n+o.metrics.durationMinutes,0));
  assert.equal(d.foodConsumedGrams,records.filter(o=>o.observationKind==='meal').reduce((n,o)=>n+o.metrics.consumedGrams,0));
  assert.equal(d.indoorPlayMinutes,records.filter(o=>o.observationKind==='play').reduce((n,o)=>n+o.metrics.durationMinutes,0));
  for(const o of records)assert.ok(Date.parse(o.observedAt)<Date.parse(o.endedAt)&&Date.parse(o.endedAt)<Date.parse(o.savedAt));
 }
 assert.equal(pet.testData.dailySummaries[5].afternoonRestMinutes,null);
 assert.equal(pet.workspace.observations.filter(o=>o.id==='momo-2026-11-03-afternoon-rest').length,0);
 assert.equal(pet.hasDemoMoments,false);assert.equal(pet.isEmptyProfile,false);
 assert.equal(pet.workspace.scenarioDate,pet.testData.periodEnd);
});
