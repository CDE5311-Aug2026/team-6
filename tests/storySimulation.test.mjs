import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/storySimulation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { buildRollingStorySimulation, isSyntheticSunnyProfile } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

const templates = [
  { id: 'db-meal', title: 'Breakfast record', image: 'pawsona-media://owner/meal', mediaType: 'image/png', observationKind: 'meal', savedAt: '2026-10-15T08:00:00+08:00' },
  { id: 'db-walk', title: 'Morning walk', image: 'pawsona-media://owner/walk', mediaType: 'image/png', observationKind: 'walk', savedAt: '2026-10-15T07:00:00+08:00' },
  { id: 'db-play', title: 'Indoor play', image: 'pawsona-media://owner/play', mediaType: 'image/png', observationKind: 'play', savedAt: '2026-10-15T16:00:00+08:00' },
  { id: 'db-rest', title: 'Afternoon rest', image: 'pawsona-media://owner/rest', mediaType: 'image/png', observationKind: 'rest', savedAt: '2026-10-15T13:45:00+08:00' },
];
const localDateKey = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

test('prepares a seven-day rolling plan plus yesterday, reuses database media, and is idempotent', () => {
  const now = new Date(2026, 9, 17, 14, 44);
  const plan = buildRollingStorySimulation(templates, now, 'sunny', 'owner', 'Admin');
  assert.ok(plan.length > 30);
  assert.ok(plan.every((entry) => entry.synthetic && entry.id.includes('sunny') && entry.image.startsWith('pawsona-media://')));
  assert.ok(plan.some((entry) => localDateKey(entry.savedAt) === '2026-10-16'));
  assert.ok(plan.some((entry) => localDateKey(entry.savedAt) === '2026-10-23'));
  assert.ok(plan.some((entry) => new Date(entry.savedAt) > now));
  assert.equal(buildRollingStorySimulation([...templates, ...plan], now, 'sunny', 'owner', 'Admin').length, 0);
});

test('uses weekday evening walks, weekend morning and evening walks, optional lunches, and intermittent play', () => {
  const now = new Date(2026, 9, 17, 14, 44);
  const plan = buildRollingStorySimulation(templates, now, 'sunny', 'owner', 'Admin');
  const saturday = plan.filter((entry) => localDateKey(entry.savedAt) === '2026-10-17');
  assert.ok(saturday.some((entry) => entry.title === 'Morning walk'));
  assert.ok(saturday.some((entry) => entry.title === 'Evening walk'));
  assert.ok(saturday.some((entry) => entry.title === 'Morning play'));
  assert.ok(!saturday.some((entry) => entry.title === 'Lunch record'));
  assert.ok(plan.some((entry) => localDateKey(entry.savedAt) === '2026-10-18' && entry.title === 'Lunch record'));
  assert.ok(!plan.some((entry) => localDateKey(entry.savedAt) === '2026-10-19' && entry.title === 'Morning walk'));
});

test('maps legacy observation titles to their matching stored media', () => {
  const legacy = [
    { id: 'old-food', title: 'Breakfast record', image: 'storage://golden/meal.png', savedAt: '2026-10-15T08:00:00+08:00' },
    { id: 'old-play', title: 'Indoor play', image: 'storage://golden/play.png', savedAt: '2026-10-15T16:00:00+08:00' },
    { id: 'old-rest', title: 'Afternoon rest', image: 'storage://golden/rest.png', savedAt: '2026-10-15T13:45:00+08:00' },
  ];
  const plan = buildRollingStorySimulation(legacy, new Date(2026, 9, 17, 14, 44), 'sunny', 'owner', 'Admin');
  assert.equal(plan.find((entry) => entry.title === 'Breakfast record').image, 'storage://golden/meal.png');
  assert.equal(plan.find((entry) => entry.title === 'Indoor play').image, 'storage://golden/play.png');
  assert.equal(plan.find((entry) => entry.title === 'Afternoon rest').image, 'storage://golden/rest.png');
});

test('repairs existing blank scheduled records from stored media templates without replacing their content', () => {
  const blankScheduled = {
    id: 'synthetic-sunny-2026-10-17-afternoon-rest',
    title: 'Afternoon rest',
    note: 'Existing simulated note that must remain unchanged.',
    image: '',
    mediaType: undefined,
    momentCount: 1,
    context: 'Scheduled simulated routine record.',
    privateRecord: false,
    savedAt: '2026-10-17T13:45:00+08:00',
    authorId: 'owner',
    authorName: 'Admin',
    synthetic: true,
    observationKind: 'rest',
    simulationKey: 'sunny:2026-10-17:afternoon-rest',
    metrics: { durationMinutes: 95 },
  };
  const plan = buildRollingStorySimulation([...templates, blankScheduled], new Date(2026, 9, 17, 14, 44), 'sunny', 'owner', 'Admin');
  const repaired = plan.find((entry) => entry.id === blankScheduled.id);

  assert.ok(repaired);
  assert.equal(repaired.image, 'pawsona-media://owner/rest');
  assert.equal(repaired.mediaType, 'image/png');
  assert.equal(repaired.note, blankScheduled.note);
  assert.deepEqual(repaired.metrics, blankScheduled.metrics);
  assert.equal(repaired.simulationKey, blankScheduled.simulationKey);
  assert.equal(buildRollingStorySimulation([...templates, blankScheduled, repaired], new Date(2026, 9, 17, 14, 44), 'sunny', 'owner', 'Admin').some((entry) => entry.id === blankScheduled.id), false);
});

test('repairs legacy synthetic IDs without simulation keys in place instead of generating duplicate rows', () => {
  const legacyBlank = {
    id: 'synthetic-pet-synthetic-sunny-20261009-v1-2026-10-17-afternoon-rest',
    title: 'Afternoon rest',
    note: 'Legacy note to preserve.',
    image: '',
    momentCount: 1,
    context: 'Scheduled simulated routine record.',
    privateRecord: false,
    savedAt: '2026-10-17T13:45:00+08:00',
    synthetic: true,
    observationKind: 'rest',
  };
  const plan = buildRollingStorySimulation([...templates, legacyBlank], new Date(2026, 9, 17, 15, 0), 'pet-synthetic-sunny-20261009-v1', 'owner', 'Admin');
  const repaired = plan.filter((entry) => entry.title === 'Afternoon rest' && localDateKey(entry.savedAt) === '2026-10-17');

  assert.equal(repaired.length, 1);
  assert.equal(repaired[0].id, legacyBlank.id);
  assert.equal(repaired[0].image, 'pawsona-media://owner/rest');
  assert.equal(repaired[0].note, legacyBlank.note);
  assert.equal(repaired[0].savedAt, legacyBlank.savedAt);
  assert.equal(repaired[0].simulationKey, 'pet-synthetic-sunny-20261009-v1:2026-10-17:afternoon-rest');
});

test('recognizes Sunny by stable pet ID and by the narrowly-scoped Golden Retriever care-group profile', () => {
  assert.equal(isSyntheticSunnyProfile({ id: 'pet-synthetic-sunny-20261009-v1', name: 'Sunny', breed: 'Golden Retriever' }), true);
  assert.equal(isSyntheticSunnyProfile({ id: 'shared-group-123', name: 'Sunny (test)', breed: 'Golden Retriever' }), true);
  assert.equal(isSyntheticSunnyProfile({ id: 'other-pet', name: 'Sunny', breed: 'Chihuahua' }), false);
  assert.equal(isSyntheticSunnyProfile({ id: 'other-pet', name: 'Milo', breed: 'Golden Retriever' }), false);
});

test('classifies a stored image from observation details when its title is generic', () => {
  const stored = [
    { id: 'db-walk', title: 'Outside', note: 'A short evening stroll along the familiar route.', image: 'storage://golden/walk.png', savedAt: '2026-10-15T18:00:00+08:00' },
    { id: 'db-play', title: 'A moment together', note: 'Sunny played fetch with a toy for a few minutes.', image: 'storage://golden/play.png', savedAt: '2026-10-15T16:00:00+08:00' },
  ];
  const plan = buildRollingStorySimulation(stored, new Date(2026, 9, 17, 14, 44), 'sunny', 'owner', 'Admin');
  assert.ok(plan.filter((entry) => entry.title === 'Evening walk').every((entry) => entry.image === 'storage://golden/walk.png'));
  assert.ok(plan.filter((entry) => entry.title === 'Morning play' || entry.title === 'Indoor play').every((entry) => entry.image === 'storage://golden/play.png'));
});
