import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/routineSummary.ts', import.meta.url), 'utf8');
const { summarizeRoutine } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64'));
const now = new Date(2026, 9, 20, 12);
const records = Array.from({ length: 9 }, (_, i) => ({ id: '' + i, title: 'Morning walk', privateRecord: false, savedAt: new Date(2026, 9, 17 + i % 3, 8).toISOString() }));
test('routine requires enough days, uses complete local days and excludes private/future/old records', () => {
  assert.equal(summarizeRoutine([], now).ready, false);
  assert.equal(summarizeRoutine(records.slice(0, 7), now).ready, false);
  const result = summarizeRoutine([...records, { ...records[0], id: 'private', privateRecord: true }, { ...records[0], id: 'today', savedAt: now.toISOString() }, { ...records[0], id: 'old', savedAt: new Date(2026, 8, 1).toISOString() }], now);
  assert.equal(result.ready, true); assert.equal(result.count, 9); assert.equal(result.days, 3);
  assert.deepEqual(result.patterns[0], { category: 'Walks', count: 9, days: 3, period: '06:00-11:59' });
});
test('routine caps the sample, deduplicates IDs and identifies simulation', () => {
  const result = summarizeRoutine(Array.from({ length: 200 }, (_, i) => ({ ...records[i % 9], id: '' + i, synthetic: true })), now);
  assert.equal(result.count, 100); assert.equal(result.capped, true); assert.equal(result.simulated, true);
  assert.equal(summarizeRoutine([...records, ...records], now).count, 9);
});
