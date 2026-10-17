import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/sharedStoryObservations.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { mergeSharedStoryObservations } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('persists newly generated shared records and keeps existing group observations', () => {
  const oldRecord = { id: 'db-1', privateRecord: false, savedAt: '2026-10-15T16:00:00Z', image: 'storage://golden/play' };
  const privateRecord = { id: 'private-1', privateRecord: true, savedAt: '2026-10-15T17:00:00Z' };
  const simulated = { id: 'simulation-1', privateRecord: false, savedAt: '2026-10-17T08:00:00Z' };
  const result = mergeSharedStoryObservations([oldRecord], [oldRecord, privateRecord, simulated]);
  assert.deepEqual(result.map(({ id }) => id), ['simulation-1', 'db-1']);
});

test('incoming records replace matching group copies and deleted IDs stay deleted', () => {
  const previous = { id: 'db-1', privateRecord: false, savedAt: '2026-10-15T16:00:00Z', image: '' };
  const restored = { ...previous, image: 'blob:restored-image' };
  const removed = { id: 'db-2', privateRecord: false, savedAt: '2026-10-15T17:00:00Z' };
  assert.deepEqual(mergeSharedStoryObservations([previous, removed], [restored], 'db-2'), [restored]);
});
