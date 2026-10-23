import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/careTasks.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { careTasksForDate, isObservationSkippedForToday, takeOverDeclinedCareTask } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

const activity = (id, hour, title) => ({
  id,
  title,
  note: `${title} simulation`,
  savedAt: new Date(2026, 9, 23, hour, 0).toISOString(),
  synthetic: true,
  simulationKey: `sunny:2026-10-23:${id}`,
});

test('builds the daily care checklist from every simulated activity', () => {
  const tomorrow = { ...activity('tomorrow-breakfast', 8, 'Tomorrow breakfast'), savedAt: new Date(2026, 9, 24, 8, 0).toISOString(), simulationKey: 'sunny:2026-10-24:breakfast' };
  const observations = [activity('breakfast', 8, 'Breakfast record'), activity('rest', 13, 'Afternoon rest'), activity('walk', 18, 'Evening walk'), tomorrow];
  const tasks = careTasksForDate([], observations, [], new Date(2026, 9, 23, 12), new Date(2026, 9, 23, 12), 'Sunny');

  assert.deepEqual(tasks.map((task) => task.title), ['Breakfast record', 'Afternoon rest', 'Evening walk']);
  assert.equal(tasks[0].status, 'done');
  assert.equal(tasks[0].autoCompleted, true);
  assert.equal(tasks[1].status, 'open');
});

test('keeps a skipped activity not-today after its scheduled time and hides its observation', () => {
  const observation = activity('walk', 18, 'Evening walk');
  const skipped = {
    id: `simulation-care-${observation.id}`,
    title: observation.title,
    note: observation.note,
    dueAt: observation.savedAt,
    assignedTo: '',
    assignedBy: 'simulation',
    status: 'skipped',
    createdAt: observation.savedAt,
    sourceObservationId: observation.id,
    occurrenceDate: '2026-10-23',
    skippedAt: new Date(2026, 9, 23, 10).toISOString(),
    skippedBy: 'owner',
  };
  const tasks = careTasksForDate([], [observation], [skipped], new Date(2026, 9, 23, 12), new Date(2026, 9, 23, 20), 'Sunny');

  assert.equal(tasks[0].status, 'skipped');
  assert.equal(isObservationSkippedForToday(observation, tasks), true);
});

test('preserves a caregiver request until the simulated activity is recorded', () => {
  const observation = activity('walk', 18, 'Evening walk');
  const requested = {
    id: `simulation-care-${observation.id}`,
    title: observation.title,
    note: observation.note,
    dueAt: observation.savedAt,
    assignedTo: 'caregiver-alex',
    assignedBy: 'owner',
    status: 'requested',
    createdAt: observation.savedAt,
    sourceObservationId: observation.id,
    occurrenceDate: '2026-10-23',
    requestNote: 'Could you handle the walk today?',
  };

  const before = careTasksForDate([], [observation], [requested], new Date(2026, 9, 23, 12), new Date(2026, 9, 23, 17), 'Sunny')[0];
  const after = careTasksForDate([], [observation], [requested], new Date(2026, 9, 23, 12), new Date(2026, 9, 23, 19), 'Sunny')[0];
  assert.equal(before.status, 'requested');
  assert.equal(before.requestNote, requested.requestNote);
  assert.equal(after.status, 'done');
  assert.equal(after.autoCompleted, true);
});

test('lets the requester take over a declined activity without losing its request history', () => {
  const declined = {
    id: 'simulation-care-dinner',
    title: 'Dinner record',
    note: 'Dinner simulation',
    dueAt: new Date(2026, 9, 23, 18, 50).toISOString(),
    assignedTo: 'caregiver-cutee',
    assignedBy: 'owner',
    status: 'declined',
    createdAt: new Date(2026, 9, 23, 12).toISOString(),
    requestNote: 'Could you handle dinner?',
    declinedBy: 'caregiver-cutee',
    declinedAt: new Date(2026, 9, 23, 13).toISOString(),
  };

  const takenOver = takeOverDeclinedCareTask(declined, 'owner');

  assert.equal(takenOver.status, 'open');
  assert.equal(takenOver.assignedTo, 'owner');
  assert.equal(takenOver.assignedBy, 'owner');
  assert.equal(takenOver.requestNote, declined.requestNote);
  assert.equal(takenOver.declinedBy, declined.declinedBy);
  assert.equal(takenOver.declinedAt, declined.declinedAt);
});

test('falls back to confirmed Pattern tasks when a day has no simulation', () => {
  const patterns = [{ id: 'breakfast', status: 'confirmed', activity: 'Breakfast', startMinute: 480, endMinute: 540 }];
  const tasks = careTasksForDate(patterns, [], [], new Date(2026, 9, 23, 12), new Date(2026, 9, 23, 12), 'Sunny');

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Sunny’s breakfast');
  assert.equal(tasks[0].sourcePatternId, 'breakfast');
});
