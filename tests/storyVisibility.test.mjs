import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/storyVisibility.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { visibleStoryObservations } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const observations = [
  { id: 'sunny-breakfast', privateRecord: false },
  { id: 'sunny-play', privateRecord: false },
  { id: 'private-note', privateRecord: true },
];

test('shows public records when an old demo-moment visibility list matches no observation IDs', () => {
  assert.deepEqual(visibleStoryObservations(observations, ['breakfast', 'window', 'toy']), observations.slice(0, 2));
});

test('preserves explicit visibility choices and private-record filtering', () => {
  assert.deepEqual(visibleStoryObservations(observations, ['sunny-play']), [observations[1]]);
  assert.deepEqual(visibleStoryObservations(observations, []), []);
  assert.deepEqual(visibleStoryObservations(observations, null), observations.slice(0, 2));
});
