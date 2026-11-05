import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/momo-care-day.json', import.meta.url)));
const source = readFileSync(new URL('../src/momoCareDemo.ts', import.meta.url), 'utf8').replace("import schedule from '../fixtures/momo-care-day.json';", `const schedule = ${JSON.stringify(fixture)};`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { advanceMomoCareDemo: advance } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const at = clock => new Date(`2026-11-05T${clock}:00+08:00`);
const fresh = () => ({ momoCareDemo: { version: 1 }, careMembers: [{ id: 'owner', name: 'Tester', role: 'Primary caregiver', detail: '' }], careTasks: [], observations: [{ id: 'history', savedAt: '2026-11-04T08:00:00+08:00' }], visibility: ['history'] });
test('new owner has an independent demo member, seven tasks, and incoming handover before morning', () => {
 const w = advance(fresh(), 'owner', at('06:00'));
 assert.equal(w.careMembers.length, 2); assert.equal(w.careTasks.length, 8); assert.equal(w.observations.length, 1);
 assert.equal(w.careTasks.filter(t => t.status === 'requested' && t.assignedTo === 'owner').length, 1);
 assert.ok(w.careTasks.slice(0, 7).every(t => t.assignedTo === 'momo-demo-alex-owner'));
 assert.equal(advance(w, 'owner', at('06:00')), w);
});
test('records only completed activity, at exact Singapore completion boundary regardless of host timezone', () => {
 let w = advance(fresh(), 'owner', at('07:42')); assert.equal(w.observations.length, 1);
 w = advance(w, 'owner', at('07:43')); assert.equal(w.observations.length, 2);
 assert.equal(w.careTasks.filter(t => t.status === 'done').length, 1);
 assert.equal(w.observations[1].authorId, 'momo-demo-alex-owner');
 assert.equal(w.observations[1].savedAt, '2026-11-05T07:10:00+08:00');
 assert.equal(w.observations[1].endedAt, '2026-11-05T07:43:00+08:00');
 assert.deepEqual(w.visibility, ['history', w.observations[1].id]);
 assert.equal(advance(w, 'owner', at('07:43')), w);
});
test('late login catches up once; history, tester edits and deleted photos survive reload', () => {
 let w = advance(fresh(), 'owner', at('22:00')); assert.equal(w.observations.length, 8);
 assert.equal(w.careTasks.filter(t => t.status === 'done').length, 7);
 w.observations = w.observations.filter(o => o.id === 'history');
 const first = w.careTasks[0]; first.status = 'accepted'; first.completionOverridden = true; first.events.push({ type: 'reopened' });
 const saved = JSON.parse(JSON.stringify(w));
 assert.equal(advance(saved, 'owner', at('23:00')), saved);
 assert.equal(saved.observations.length, 1); assert.equal(saved.careTasks[0].status, 'accepted');
});
test('skipped, reassigned, manually completed and removed tasks are never reset', () => {
 let w = advance(fresh(), 'owner', at('06:00'));
 w.careTasks[0].status = 'skipped'; w.careTasks[1].assignedTo = 'owner'; w.careTasks[2].status = 'done'; w.careTasks[2].completedBy = 'owner';
 w.careTasks.splice(3, 1);
 w = advance(w, 'owner', at('22:00'));
 assert.equal(w.careTasks.length, 7); assert.equal(w.observations.length, 4);
 assert.equal(w.careTasks[0].status, 'skipped'); assert.equal(w.careTasks[1].status, 'accepted'); assert.equal(w.careTasks[2].completedBy, 'owner');
});
test('request gets a simulated acceptance after 30 seconds, without fabricated completion', () => {
 let w = advance(fresh(), 'owner', at('06:00'));
 w.careTasks.push({ id: 'custom', title: 'Custom care', assignedTo: 'momo-demo-alex-owner', assignedBy: 'owner', status: 'requested', dueAt: at('09:00').toISOString(), createdAt: at('06:00').toISOString() });
 assert.equal(advance(w, 'owner', new Date(+at('06:00') + 29000)), w);
 w = advance(w, 'owner', new Date(+at('06:00') + 30000));
 assert.equal(w.careTasks.at(-1).status, 'accepted'); assert.equal(w.careTasks.at(-1).events.at(-1).targetId, 'owner');
 w = advance(w, 'owner', at('22:00')); assert.equal(w.careTasks.at(-1).status, 'accepted');
});
test('removed, expired or viewer member stops simulation; next day creates only current day', () => {
 const w = advance(fresh(), 'owner', at('06:00'));
 for (const member of [null, { access: 'viewer' }, { expiresAt: '2026-11-04' }]) {
  const restricted = structuredClone(w);
  if (!member) restricted.careMembers.pop(); else Object.assign(restricted.careMembers[1], member);
  assert.equal(advance(restricted, 'owner', at('22:00')), restricted);
 }
 const next = advance(w, 'owner', new Date('2026-11-07T00:01:00+08:00'));
 assert.equal(next.careTasks.length, 16); assert.equal(next.observations.length, 1);
 assert.ok(!next.careTasks.some(t => t.occurrenceDate === '2026-11-06'));
 assert.equal(advance({ ...fresh(), momoCareDemo: undefined }, 'owner', at('22:00')).careMembers.length, 1);
 const other = advance(fresh(), 'different-owner', at('22:00')); assert.equal(other.careMembers.at(-1).id, 'momo-demo-alex-different-owner');
});
