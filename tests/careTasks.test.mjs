import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/careTasks.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { careRhythmForDate, toggleCareTaskCompletion, canToggleCareTaskCompletion, canRemindCareTask, careTaskTiming, appendCareTaskEvent, careTaskAttentionCount, careTaskInboxCount, careTaskSummaryTasks, careTaskUnreadCount, careTasksForDate, isObservationSkippedForToday, markCareTaskEventsRead, releaseAcceptedCareTask, takeOverDeclinedCareTask } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

const activity = (id, hour, title) => ({
  id,
  title,
  note: `${title} simulation`,
  savedAt: new Date(2026, 9, 23, hour, 0).toISOString(),
  synthetic: true,
  simulationKey: `sunny:2026-10-23:${id}`,
  authorId: 'owner',
  authorName: 'Emily',
});

test('builds the daily care checklist from every simulated activity', () => {
  const tomorrow = { ...activity('tomorrow-breakfast', 8, 'Tomorrow breakfast'), savedAt: new Date(2026, 9, 24, 8, 0).toISOString(), simulationKey: 'sunny:2026-10-24:breakfast' };
  const observations = [activity('breakfast', 8, 'Breakfast record'), activity('rest', 13, 'Afternoon rest'), activity('walk', 18, 'Evening walk'), tomorrow];
  const tasks = careTasksForDate([], observations, [], new Date(2026, 9, 23, 12), new Date(2026, 9, 23, 12), 'Sunny');

  assert.deepEqual(tasks.map((task) => task.title), ['Breakfast record', 'Afternoon rest', 'Evening walk']);
  assert.equal(tasks[0].status, 'done');
  assert.equal(tasks[0].autoCompleted, true);
  assert.equal(tasks[0].completedBy, 'simulation');
  assert.equal(tasks[0].completedByName, 'Pawsona simulation');
  assert.equal(tasks[0].events.at(-1).type, 'auto_completed');
  assert.equal(tasks[0].events.at(-1).actorId, 'simulation');
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
  assert.equal(after.completedBy, 'simulation');
});

test('does not attribute simulated completion to an assigned caregiver', () => {
  const observation = activity('rest', 13, 'Afternoon rest');
  const accepted = {
    id: `simulation-care-${observation.id}`,
    title: observation.title,
    note: observation.note,
    dueAt: observation.savedAt,
    assignedTo: 'caregiver-cutee',
    assignedBy: 'owner',
    status: 'accepted',
    createdAt: observation.savedAt,
    sourceObservationId: observation.id,
    occurrenceDate: '2026-10-23',
    acceptedAt: new Date(2026, 9, 23, 12).toISOString(),
  };

  const completed = careTasksForDate([], [observation], [accepted], new Date(2026, 9, 23, 12), new Date(2026, 9, 23, 14), 'Sunny')[0];

  assert.equal(completed.status, 'done');
  assert.equal(completed.completedBy, 'simulation');
  assert.equal(completed.completedByName, 'Pawsona simulation');
  assert.equal(completed.events.at(-1).actorId, 'simulation');
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

test('lets an assigned caregiver step back after accepting while preserving acceptance history', () => {
  const acceptedAt = new Date(2026, 9, 23, 12, 30).toISOString();
  const declinedAt = new Date(2026, 9, 23, 13).toISOString();
  const accepted = {
    id: 'simulation-care-rest',
    title: 'Afternoon rest',
    note: 'Rest simulation',
    dueAt: new Date(2026, 9, 23, 13, 45).toISOString(),
    assignedTo: 'caregiver-cutee',
    assignedBy: 'owner',
    status: 'accepted',
    createdAt: new Date(2026, 9, 23, 12).toISOString(),
    acceptedAt,
  };

  const released = releaseAcceptedCareTask(accepted, 'caregiver-cutee', declinedAt);

  assert.equal(released.status, 'declined');
  assert.equal(released.assignedTo, 'caregiver-cutee');
  assert.equal(released.acceptedAt, acceptedAt);
  assert.equal(released.declinedBy, 'caregiver-cutee');
  assert.equal(released.declinedAt, declinedAt);
});

test('keeps an append-only request history and counts unread inbox events', () => {
  const base = {
    id: 'simulation-care-walk',
    title: 'Evening walk',
    note: 'Walk simulation',
    dueAt: new Date(2026, 9, 23, 18, 20).toISOString(),
    assignedTo: 'caregiver-cutee',
    assignedBy: 'owner',
    status: 'requested',
    createdAt: new Date(2026, 9, 23, 12).toISOString(),
  };
  const requested = appendCareTaskEvent(base, { type: 'requested', actorId: 'owner', targetId: 'caregiver-cutee', createdAt: new Date(2026, 9, 23, 12, 1).toISOString() });
  const accepted = appendCareTaskEvent({ ...requested, status: 'accepted', acceptedAt: new Date(2026, 9, 23, 12, 5).toISOString() }, { type: 'accepted', actorId: 'caregiver-cutee', targetId: 'owner', createdAt: new Date(2026, 9, 23, 12, 5).toISOString() });

  assert.deepEqual(accepted.events.map((event) => event.type), ['requested', 'accepted']);
  assert.equal(careTaskInboxCount([accepted], 'owner', true), 1);
  assert.equal(careTaskUnreadCount([accepted], 'owner'), 1);
  assert.equal(careTaskAttentionCount([accepted], 'owner', true), 0);

  const read = markCareTaskEventsRead([accepted], 'owner');
  assert.equal(read[0].events[1].readBy.includes('owner'), true);
  assert.equal(careTaskUnreadCount(read, 'owner'), 0);
  assert.equal(careTaskInboxCount(read, 'owner', true), 0);
});

test('keeps unresolved attention visible after its notification is read', () => {
  const declined = appendCareTaskEvent({
    id: 'simulation-care-dinner-alert',
    title: 'Dinner record',
    note: 'Dinner simulation',
    dueAt: new Date(2026, 9, 23, 18, 50).toISOString(),
    assignedTo: 'caregiver-cutee',
    assignedBy: 'owner',
    status: 'declined',
    createdAt: new Date(2026, 9, 23, 12).toISOString(),
    declinedBy: 'caregiver-cutee',
  }, { type: 'released', actorId: 'caregiver-cutee', targetId: 'owner', createdAt: new Date(2026, 9, 23, 13).toISOString() });

  const read = markCareTaskEventsRead([declined], 'owner');

  assert.equal(careTaskUnreadCount(read, 'owner'), 0);
  assert.equal(careTaskAttentionCount(read, 'owner', true), 1);
  assert.equal(careTaskInboxCount(read, 'owner', true), 1);
});

test('summarizes Today with the latest completed and next unfinished activity', () => {
  const tasks = [
    { ...activity('breakfast-summary', 8, 'Breakfast'), status: 'done' },
    { ...activity('rest-summary', 13, 'Afternoon rest'), status: 'done' },
    { ...activity('walk-summary', 18, 'Evening walk'), status: 'open' },
    { ...activity('dinner-summary', 19, 'Dinner'), status: 'open' },
  ].map((entry) => ({ ...entry, dueAt: entry.savedAt, assignedTo: '', assignedBy: '', createdAt: entry.savedAt }));

  const summary = careTaskSummaryTasks(tasks, new Date(2026, 9, 23, 14));

  assert.deepEqual(summary.map((task) => task.title), ['Afternoon rest', 'Evening walk']);
});

test('prioritizes overdue or declined work and excludes not-today activities from Today summary', () => {
  const tasks = [
    { ...activity('skipped-summary', 12, 'Skipped lunch'), status: 'skipped' },
    { ...activity('overdue-summary', 13, 'Overdue rest'), status: 'open' },
    { ...activity('declined-summary', 18, 'Declined walk'), status: 'declined' },
    { ...activity('upcoming-summary', 19, 'Dinner'), status: 'open' },
  ].map((entry) => ({ ...entry, dueAt: entry.savedAt, assignedTo: '', assignedBy: '', createdAt: entry.savedAt }));

  const summary = careTaskSummaryTasks(tasks, new Date(2026, 9, 23, 14));

  assert.deepEqual(summary.map((task) => task.title), ['Overdue rest', 'Declined walk']);
  assert.equal(summary.some((task) => task.status === 'skipped'), false);
});

test('falls back to confirmed Pattern tasks when a day has no simulation', () => {
  const patterns = [{ id: 'breakfast', status: 'confirmed', activity: 'Breakfast', startMinute: 480, endMinute: 540 }];
  const tasks = careTasksForDate(patterns, [], [], new Date(2026, 9, 23, 12), new Date(2026, 9, 23, 12), 'Sunny');

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].title, 'Feed Sunny breakfast');
  assert.equal(tasks[0].sourcePatternId, 'breakfast');
});

test('routine time prompts respect the whole confirmed window and close after completion', () => {
  const [task] = careTasksForDate([{ id: 'meal', status: 'confirmed', activity: 'Breakfast', startMinute: 540, endMinute: 570 }], [], [], new Date(2026, 9, 23), new Date(2026, 9, 23, 8), 'Sunny');
  assert.equal(careTaskTiming(task, new Date(2026, 9, 23, 8, 44)), 'upcoming');
  assert.equal(careTaskTiming(task, new Date(2026, 9, 23, 8, 45)), 'soon');
  assert.equal(careTaskTiming(task, new Date(2026, 9, 23, 9)), 'due');
  assert.equal(careTaskTiming(task, new Date(2026, 9, 23, 9, 30)), 'due');
  assert.equal(careTaskTiming(task, new Date(2026, 9, 23, 10)), 'overdue');
  assert.equal(careTaskTiming({ ...task, status: 'done' }, new Date(2026, 9, 23, 10)), 'closed');
  assert.equal(careTaskTiming({ ...task, status: 'skipped' }, new Date(2026, 9, 23, 10)), 'closed');
});
test('reminders notify the named recipient without changing accepted responsibility and limit repeats', () => {
  const now = new Date(2026, 9, 23, 10);
  const base = { id: 'meal', title: 'Feed Sunny breakfast', note: '', dueAt: new Date(2026, 9, 23, 9).toISOString(), assignedTo: 'mum', assignedBy: 'owner', status: 'accepted', createdAt: now.toISOString() };
  assert.equal(canRemindCareTask(base, 'mum', now), true);
  const reminded = appendCareTaskEvent(base, { type: 'reminded', actorId: 'owner', targetId: 'mum', createdAt: now.toISOString() });
  assert.equal(reminded.status, 'accepted');
  assert.equal(reminded.assignedTo, 'mum');
  assert.equal(careTaskUnreadCount([reminded], 'mum'), 1);
  assert.equal(careTaskUnreadCount([reminded], 'owner'), 0);
  assert.equal(canRemindCareTask(reminded, 'mum', new Date(+now + 299999)), false);
  assert.equal(canRemindCareTask(reminded, 'mum', new Date(+now + 300000)), true);
  assert.equal(canRemindCareTask(reminded, 'other-helper', now), true);
  assert.equal(canRemindCareTask({ ...base, status: 'done' }, 'mum', now), false);
  assert.equal(canRemindCareTask({ ...base, status: 'skipped' }, 'mum', now), false);
  assert.equal(canRemindCareTask(base, '', now), false);
});

test('completion can be undone and checked again with actual timestamps and preserved history', () => {
  const base = { id:'walk',title:'Walk Sunny',note:'',dueAt:new Date(2026,9,23,18).toISOString(),assignedTo:'mum',assignedBy:'owner',status:'accepted',acceptedAt:new Date(2026,9,23,9).toISOString(),createdAt:new Date(2026,9,23,9).toISOString() };
  const first = toggleCareTaskCompletion(base,'mum','Mum',false,new Date(2026,9,23,10));
  assert.equal(first.status,'done'); assert.equal(first.completedByName,'Mum');
  const undo = toggleCareTaskCompletion(first,'mum','Mum',false,new Date(2026,9,23,10,1));
  assert.equal(undo.status,'accepted'); assert.equal(undo.completedAt,undefined); assert.equal(undo.completedBy,undefined);
  assert.equal(undo.completionOverridden,true);
  const second = toggleCareTaskCompletion(undo,'mum','Mum',false,new Date(2026,9,23,10,5));
  assert.equal(second.completedAt,new Date(2026,9,23,10,5).toISOString());
  assert.deepEqual(second.events.map(e=>e.type),['completed','reopened','completed']);
  assert.equal(canToggleCareTaskCompletion(second,'other',false),false);
  assert.equal(toggleCareTaskCompletion(second,'other','Other',false),null);
  assert.equal(canToggleCareTaskCompletion(second,'owner',true),true);
});
test('undoing a simulated task stays undone after its scheduled time, even after a reminder', () => {
  const record=activity('undo-breakfast',8,'Breakfast record'), date=new Date(2026,9,23,12);
  const done=careTasksForDate([], [record], [], date, date,'Sunny')[0];
  const undo=toggleCareTaskCompletion(done,'owner','Emily',true,date);
  const reminded=appendCareTaskEvent(undo,{type:'reminded',actorId:'owner',targetId:'mum',createdAt:date.toISOString()});
  const reloaded=careTasksForDate([], [record], [reminded], date,new Date(2026,9,23,20),'Sunny')[0];
  assert.equal(reloaded.status,'open'); assert.equal(reloaded.completedAt,undefined);
  const rhythm=careRhythmForDate([record],[reloaded],date,new Date(2026,9,23,20));
  assert.equal(rhythm.records.length,0); assert.equal(rhythm.completions.length,0);
});
test('rhythm uses actual completion time, replaces a linked simulation and retains unrelated real evidence', () => {
  const source=activity('future-walk',18,'Evening walk'), actual=new Date(2026,9,23,10,12), date=new Date(2026,9,23);
  const base=careTasksForDate([], [source], [], date,new Date(2026,9,23,9),'Sunny')[0];
  const done=toggleCareTaskCompletion(base,'mum','Mum',true,actual);
  const independent={id:'real',title:'A real walk record',savedAt:new Date(2026,9,23,10).toISOString(),synthetic:false};
  const now=new Date(2026,9,23,20);
  const rhythm=careRhythmForDate([source,independent],[done,done],date,now);
  assert.deepEqual(rhythm.records.map(r=>r.id),['real']);
  assert.equal(rhythm.completions.length,1);
  assert.equal(rhythm.completions[0].savedAt,actual.toISOString());
  assert.equal(rhythm.completions[0].observationKind,'walk');
  assert.equal(rhythm.completions[0].authorName,'Mum');
  const undone=toggleCareTaskCompletion(done,'mum','Mum',false,now);
  const after=careRhythmForDate([source,independent],[undone],date,now);
  assert.deepEqual(after.records.map(r=>r.id),['real']); assert.equal(after.completions.length,0);
});
test('rhythm places overnight completion on its actual day, excludes future/private data and ignores reopened tasks', () => {
  const yesterday=new Date(2026,9,22,22), actual=new Date(2026,9,23,0,10), now=new Date(2026,9,23,12);
  const task={id:'meal',title:'Feed Sunny dinner',note:'',dueAt:yesterday.toISOString(),assignedTo:'mum',assignedBy:'owner',status:'done',createdAt:yesterday.toISOString(),completedAt:actual.toISOString(),completedBy:'mum'};
  const current=careRhythmForDate([{id:'private',title:'private',savedAt:actual.toISOString(),privateRecord:true}],[task],now,now,{mum:'Mum'});
  assert.equal(current.records.length,0); assert.equal(current.completions.length,1); assert.equal(current.completions[0].observationKind,'meal');
  assert.equal(careRhythmForDate([], [task], yesterday,now).completions.length,0);
  assert.equal(careRhythmForDate([], [{...task,completedAt:new Date(2026,9,23,15).toISOString()}], now,now).completions.length,0);
  assert.equal(careRhythmForDate([], [{...task,status:'open'}], now,now).completions.length,0);
});
