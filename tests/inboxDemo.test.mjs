import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const modelUrl = url(compile('../src/inboxModel.ts'));
const compiled = compile('../src/inboxDemo.ts').replace("'./inboxModel'", JSON.stringify(modelUrl));
const { buildInboxDemo, isInboxDemoTask, inboxExamplesForCreatedAt, INBOX_EXAMPLES_ROLLOUT_AT } = await import(url(compiled));
const pet = { id: 'sunny', name: 'Sunny', avatar: '' };
const now = new Date('2026-11-05T04:00:00Z');
const state = { version: 1, startedAt: now.toISOString() };
test('seeds every category with an actionable incoming task without external workspace writes', () => {
  const original = structuredClone(pet);
  const messages = buildInboxDemo(pet, 'daughter', state, [], now);
  assert.deepEqual(pet, original);
  assert.deepEqual([...new Set(messages.map(m => m.category))].sort(), ['care','pet','social']);
  const request = messages.find(m => m.needsResponse);
  assert.equal(request.title, 'Mom asked you to feed Sunny.');
  assert.equal(request.assigneeName, 'You');
  assert.equal(messages.filter(m => m.needsResponse).length, 1);
  assert.ok(messages.every(m => m.demo));
  assert.ok(messages.some(m => m.title.includes('Dad completed')));
});
test('stable identities preserve read state across reloads and separate test accounts', () => {
  const first = buildInboxDemo(pet, 'daughter', state, [], now);
  const reload = buildInboxDemo(pet, 'daughter', state, first.map(m=>m.id), new Date(+now+60000));
  assert.deepEqual(reload.map(m=>m.id), first.map(m=>m.id));
  assert.ok(reload.every(m => m.read));
  const other = buildInboxDemo(pet, 'other', state, first.map(m=>m.id), now);
  assert.ok(other.every(m=>!m.read));
});
test('acceptance and decline survive persisted state without creating real care tasks', () => {
  for (const response of ['accepted', 'declined']) {
    const saved = JSON.parse(JSON.stringify({ ...state, response, respondedAt: now.toISOString() }));
    const messages = buildInboxDemo(pet, 'daughter', saved, [], now);
    assert.ok(messages.every(m=>!m.needsResponse));
    const request = messages.find(m=>m.task?.id.endsWith('-feed'));
    assert.equal(request.task.status,response);
  }
});
test('visible message content uses ordinary family names without Demo labels', () => {
  const messages = buildInboxDemo(pet, 'daughter', state, [], now);
  for (const message of messages) assert.doesNotMatch(`${message.title} ${message.body} ${message.actorName}`, /demo|fictional/i);
});
test('only the exact account and pet task can receive a simulated response', () => {
  const task = buildInboxDemo(pet, 'daughter', state, [], now).find(m=>m.needsResponse).task;
  assert.equal(isInboxDemoTask(task.id,pet.id,'daughter'),true);
  assert.equal(isInboxDemoTask(task.id,pet.id,'other'),false);
  assert.equal(isInboxDemoTask('real-task',pet.id,'daughter'),false);
});
test('only new registrations after rollout receive examples, never existing accounts or guests', () => {
  assert.equal(inboxExamplesForCreatedAt('2026-11-05T15:20:00Z'), false);
  assert.equal(inboxExamplesForCreatedAt('2026-10-01T00:00:00Z'), false);
  assert.equal(inboxExamplesForCreatedAt(undefined), false);
  assert.equal(inboxExamplesForCreatedAt('invalid'), false);
  assert.equal(inboxExamplesForCreatedAt(INBOX_EXAMPLES_ROLLOUT_AT), true);
  assert.equal(inboxExamplesForCreatedAt('2026-11-06T00:00:00Z'), true);
});
