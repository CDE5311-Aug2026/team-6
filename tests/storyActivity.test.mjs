import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/storyActivity.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { storyActivity, storyActivityKind } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
test('renaming meal and unknown-amount water records preserves their semantic kind', () => {
  assert.equal(storyActivity('QA renamed breakfast', 'meal'), 'Meal');
  assert.equal(storyActivity('After the walk', 'water'), 'Water');
  assert.equal(storyActivityKind('Refilled water'), 'water-refill');
  assert.equal(storyActivity('Bowl refreshed', 'water-refill'), 'Refilled water');
});
test('legacy records keep intake semantics from stored measurements without guessing arbitrary titles', () => {
  assert.equal(storyActivity('Renamed', undefined, {foodGrams:15}), 'Meal');
  assert.equal(storyActivity('Renamed', undefined, {waterMilliliters:20}), 'Water');
  assert.equal(storyActivity('A written note'), '');
  assert.equal(storyActivity('Meal'), 'Meal');
});
