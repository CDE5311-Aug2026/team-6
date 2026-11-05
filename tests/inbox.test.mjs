import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/inboxModel.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { buildInbox, taskAdvice } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const now = new Date('2026-11-05T12:00:00Z');
const stamp = '2026-11-05T00:00:00Z';
const task = { id: 'breakfast', title: 'Feed Sunny', note: 'Serve 200g of her usual food', dueAt: stamp, assignedTo: 'daughter', assignedBy: 'mom', status: 'requested', createdAt: stamp, events: [{ id: 'e1', type: 'requested', actorId: 'mom', targetId: 'daughter', createdAt: stamp }] };
const space = () => ({ id: 'sunny', name: 'Sunny', avatar: '', workspace: { careTasks: [structuredClone(task)], observations: [], contexts: [], momentEngagement: {}, lifeEvents: [], careMembers: [{ id: 'mom', name: 'Mom' }, { id: 'daughter', name: 'Daughter' }, { id: 'dad', name: 'Dad' }] } });
test('request recipient sees an actionable message; other family members see the handover', () => {
  const recipient = buildInbox([space()], 'daughter', [], now)[0];
  assert.equal(recipient.title, 'Mom asked you to feed Sunny.');
  assert.equal(recipient.needsResponse, true);
  const family = buildInbox([space()], 'dad', [], now)[0];
  assert.equal(family.title, 'Mom asked Daughter to feed Sunny.');
  assert.equal(family.needsResponse, false);
  assert.deepEqual(buildInbox([space()], 'mom', [], now), []);
});
test('read status is recipient-specific and message IDs are scoped to the pet', () => {
  const other = { ...space(), id: 'other-pet' };
  const messages = buildInbox([space(), other], 'daughter', ['sunny:task:e1'], now);
  assert.equal(messages.filter(m => m.read).length, 1);
  assert.equal(buildInbox([space()], 'dad', [], now)[0].read, false);
});
test('accepted or reassigned requests no longer prompt the original recipient to accept', () => {
  const pet = space();
  pet.workspace.careTasks[0].status = 'accepted';
  assert.equal(buildInbox([pet], 'daughter', [], now)[0].needsResponse, false);
  pet.workspace.careTasks[0].status = 'requested';
  pet.workspace.careTasks[0].assignedTo = 'dad';
  assert.equal(buildInbox([pet], 'daughter', [], now)[0].needsResponse, false);
});
test('private records and their comments never enter the inbox', () => {
  const pet = space();
  pet.workspace.careTasks = [];
  pet.workspace.observations = [{ id: 'private', title: 'Private', note: 'secret', savedAt: stamp, privateRecord: true, authorId: 'mom' }];
  pet.workspace.contexts = [{ id: 'c', momentId: 'private', note: 'secret note', savedAt: stamp, authorId: 'mom', comments: [{ id: 'comment', authorId: 'dad', authorName: 'Dad', body: 'secret comment', createdAt: stamp }] }];
  assert.deepEqual(buildInbox([pet], 'daughter', [], now), []);
});
test('future pet records stay out; comments and new likes use their own actual time', () => {
  const pet = space();
  pet.workspace.careTasks = [];
  pet.workspace.observations = [{ id: 'm', title: 'Breakfast', note: 'Ate well', savedAt: stamp, privateRecord: false, authorId: 'daughter' }, { id: 'future', title: 'Dinner', note: 'Not yet', savedAt: '2026-11-06T00:00:00Z', privateRecord: false }];
  pet.workspace.momentEngagement = { m: { likes: ['mom'], likeEvents: [{ actorId: 'mom', createdAt: '2026-11-05T01:00:00Z' }] } };
  const messages = buildInbox([pet], 'daughter', [], now);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].category, 'social');
  assert.equal(messages[0].createdAt, '2026-11-05T01:00:00Z');
});
test('historical likes without timestamps and private favorites produce no invented messages', () => {
  const pet = space();
  pet.workspace.careTasks = [];
  pet.workspace.observations = [{ id: 'm', title: 'Breakfast', note: '', savedAt: stamp, privateRecord: false, authorId: 'daughter' }];
  pet.workspace.momentEngagement = { m: { likes: ['mom'], favorites: ['dad'] } };
  assert.deepEqual(buildInbox([pet], 'daughter', [], now), []);
});
test('guidance uses the specified amount and never invents a feeding portion', () => {
  assert.equal(taskAdvice(task).amount, '200g');
  const advice = taskAdvice({ ...task, note: '' });
  assert.equal(advice.amount, undefined);
  assert.match(advice.text, /No portion is specified/);
  assert.doesNotMatch(advice.text, /200/);
});
