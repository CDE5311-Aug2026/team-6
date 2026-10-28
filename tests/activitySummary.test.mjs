import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/activitySummary.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { activityCategoryLabel, activityCategoryRecords, activityInsightReviewFor, activityInsightReviewId, activityPeriodFor, activityRecordsOnDate, activityRecordsThroughDate, activitySummaryDateWindow, activitySummaryIdentity, attentionActivityInsights, compareActivityWeeks, rankDailyActivityInsights, selectWeeklyInsight } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('selects the largest meaningful relative weekly change using per-record averages', () => {
  const current = { recordCount: 7, durationMinutes: 57, durationRecordCount: 7, consumedGrams: 1125, consumptionRecordCount: 7 };
  const previous = { recordCount: 6, durationMinutes: 41, durationRecordCount: 6, consumedGrams: 960, consumptionRecordCount: 6 };
  const insight = selectWeeklyInsight(current, previous);

  assert.equal(insight.key, 'duration');
  assert.equal(insight.current, 57 / 7);
  assert.equal(insight.previous, 41 / 6);
  assert.ok(Math.abs(insight.relativeChange - ((57 / 7 - 41 / 6) / (41 / 6))) < 0.0001);
});

test('does not force a standout insight when all relative changes are small', () => {
  const current = { recordCount: 6, durationMinutes: 61, durationRecordCount: 6, consumedGrams: 965, consumptionRecordCount: 6 };
  const previous = { recordCount: 6, durationMinutes: 60, durationRecordCount: 6, consumedGrams: 960, consumptionRecordCount: 6 };
  assert.equal(selectWeeklyInsight(current, previous), null);
});

test('record-count change alone is not ranked when per-record averages are stable', () => {
  const current = { recordCount: 3, durationMinutes: 15, durationRecordCount: 3, consumedGrams: 300, consumptionRecordCount: 3 };
  const previous = { recordCount: 6, durationMinutes: 30, durationRecordCount: 6, consumedGrams: 600, consumptionRecordCount: 6 };
  assert.equal(selectWeeklyInsight(current, previous), null);
});

test('ranks today against each behavior’s average across all prior recorded days', () => {
  const records = [];
  const add = (title, observationKind, day, durationMinutes, consumedGrams) => records.push({
    title,
    observationKind,
    savedAt: new Date(2026, 9, day, 10).toISOString(),
    metrics: { durationMinutes, consumedGrams },
  });
  add('Breakfast record', 'meal', 14, 8, 150);
  add('Breakfast record', 'meal', 15, 10, 150);
  add('Breakfast record', 'meal', 16, 9, 150);
  add('Breakfast record', 'meal', 21, 12, 180);
  // A larger duration change makes this the standout; future data is excluded.
  add('Afternoon play', 'play', 14, 10);
  add('Afternoon play', 'play', 15, 10);
  add('Afternoon play', 'play', 16, 10);
  add('Afternoon play', 'play', 21, 15);
  add('Afternoon play', 'play', 22, 50);

  const ranked = rankDailyActivityInsights(records, new Date(2026, 9, 21, 23));
  assert.equal(ranked[0].activityLabel, 'Afternoon play');
  assert.equal(ranked[0].key, 'duration');
  assert.equal(ranked[0].current, 15);
  assert.equal(ranked[0].previous, 10);
  assert.equal(ranked[0].relativeChange, 0.5);
  assert.equal(ranked[0].currentSampleSize, 1);
  assert.equal(ranked[0].baselineSampleSize, 3);
  assert.equal(ranked[0].baselineDays, 3);
  assert.equal(ranked[0].baselineStartDate.getDate(), 14);
  assert.equal(ranked[0].baselineEndDate.getDate(), 20);
});

test('does not count days without records as zero in the daily baseline', () => {
  const records = [
    { title: 'Afternoon play', observationKind: 'play', savedAt: new Date(2026, 9, 14, 16).toISOString(), metrics: { durationMinutes: 10 } },
    { title: 'Afternoon play', observationKind: 'play', savedAt: new Date(2026, 9, 15, 16).toISOString(), metrics: { durationMinutes: 20 } },
    { title: 'Afternoon play', observationKind: 'play', savedAt: new Date(2026, 9, 16, 16).toISOString(), metrics: { durationMinutes: 10 } },
    { title: 'Afternoon play', observationKind: 'play', savedAt: new Date(2026, 9, 21, 16).toISOString(), metrics: { durationMinutes: 15 } },
  ];
  const [insight] = rankDailyActivityInsights(records, new Date(2026, 9, 21, 23));

  // Baseline is the mean of daily means (10, 20, 10), not a seven-day mean with four zero days.
  assert.equal(insight.previous, 40 / 3);
  assert.equal(insight.baselineDays, 3);
});

test('uses the full recorded history through yesterday rather than only the prior week', () => {
  const records = [1, 14, 15, 16].map((day, index) => ({
    title: 'Breakfast record',
    observationKind: 'meal',
    savedAt: new Date(2026, 9, day, 8).toISOString(),
    metrics: { durationMinutes: index === 0 ? 30 : 10 },
  }));
  records.push({ title: 'Breakfast record', observationKind: 'meal', savedAt: new Date(2026, 9, 21, 8).toISOString(), metrics: { durationMinutes: 12 } });

  const [insight] = rankDailyActivityInsights(records, new Date(2026, 9, 21, 10));
  assert.equal(insight.previous, 15);
  assert.equal(insight.baselineDays, 4);
  assert.equal(insight.baselineStartDate.getDate(), 1);
  assert.equal(insight.baselineEndDate.getDate(), 20);
});

test('fills up to three daily slots with smaller changes only after main-threshold changes', () => {
  const records = [];
  const activities = [
    ['Breakfast record', 'meal'],
    ['Dinner record', 'meal'],
    ['Morning walk', 'walk'],
    ['Afternoon rest', 'rest'],
  ];
  for (const [title, observationKind] of activities) {
    for (const day of [14, 15, 16]) records.push({ title, observationKind, savedAt: new Date(2026, 9, day, 10).toISOString(), metrics: { durationMinutes: 10 } });
    records.push({ title, observationKind, savedAt: new Date(2026, 9, 21, 10).toISOString(), metrics: { durationMinutes: 10.5 } });
  }

  const ranked = rankDailyActivityInsights(records, new Date(2026, 9, 21, 23));
  assert.equal(ranked.length, 3);
  assert.ok(ranked.every(insight => !insight.meetsThreshold));
  assert.ok(ranked.every(insight => Math.abs(insight.relativeChange - 0.05) < 0.0001));
});

test('uses a stable per-day activity and metric id for insight reviews', () => {
  const currentDate = new Date(2026, 9, 21);
  const duration = { activityKey: 'rest:afternoon', key: 'duration', currentDate };
  const food = { ...duration, key: 'food' };

  assert.equal(activityInsightReviewId(duration), '2026-10-21:rest%3Aafternoon:duration');
  assert.notEqual(activityInsightReviewId(duration), activityInsightReviewId(food));
});

test('hides normal reviews from Today and prioritizes changes marked for attention', () => {
  const currentDate = new Date(2026, 9, 21);
  const insight = (activityKey, key = 'duration') => ({ activityKey, activityLabel: activityKey, key, currentDate });
  const insights = [insight('breakfast'), insight('play'), insight('rest')];
  const reviews = [
    { id: activityInsightReviewId(insights[0]), status: 'normal' },
    { id: activityInsightReviewId(insights[2]), status: 'watch' },
  ];

  assert.equal(activityInsightReviewFor(reviews, insights[0]).status, 'normal');
  assert.deepEqual(attentionActivityInsights(insights, reviews).map(entry => entry.activityKey), ['rest', 'play']);
});

test('does not use a later same-day record until its event time has arrived', () => {
  const records = [14, 15, 16].map(day => ({
    title: 'Breakfast record',
    observationKind: 'meal',
    savedAt: new Date(2026, 9, day, 8).toISOString(),
    metrics: { durationMinutes: 10 },
  }));
  records.push(
    { title: 'Breakfast record', observationKind: 'meal', savedAt: new Date(2026, 9, 21, 8).toISOString(), metrics: { durationMinutes: 10 } },
    { title: 'Breakfast record', observationKind: 'meal', savedAt: new Date(2026, 9, 21, 12).toISOString(), metrics: { durationMinutes: 30 } },
  );

  const beforeEvent = rankDailyActivityInsights(records, new Date(2026, 9, 21, 10));
  const afterEvent = rankDailyActivityInsights(records, new Date(2026, 9, 21, 13));
  assert.equal(beforeEvent.length, 0);
  assert.equal(afterEvent[0].current, 20);
  assert.equal(afterEvent[0].meetsThreshold, true);
});

test('keeps breakfast, lunch, and dinner in distinct summaries with sensible default periods', () => {
  const breakfast = activitySummaryIdentity({ title: 'Breakfast record', observationKind: 'meal', savedAt: '2026-10-21T08:00:00+08:00' });
  const sameBreakfast = activitySummaryIdentity({ title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-20T08:10:00+08:00' });
  const lunch = activitySummaryIdentity({ title: 'Lunch record', observationKind: 'meal', savedAt: '2026-10-20T12:20:00+08:00' });
  const dinner = activitySummaryIdentity({ title: 'Dinner record', observationKind: 'meal', savedAt: '2026-10-20T18:50:00+08:00' });

  assert.equal(breakfast.key, sameBreakfast.key);
  assert.equal(breakfast.label, 'Breakfast');
  assert.equal(breakfast.defaultPeriod, 'morning');
  assert.equal(lunch.label, 'Lunch');
  assert.equal(lunch.defaultPeriod, 'afternoon');
  assert.equal(dinner.label, 'Dinner');
  assert.equal(dinner.defaultPeriod, 'evening');
  assert.notEqual(breakfast.key, lunch.key);
  assert.notEqual(lunch.key, dinner.key);
});

test('stat cards can aggregate all meal records while retaining activity-specific groups elsewhere', () => {
  const records = [
    { id: 'breakfast', title: 'Breakfast record', observationKind: 'meal', savedAt: '2026-10-21T08:00:00+08:00' },
    { id: 'lunch', title: 'Lunch record', observationKind: 'meal', savedAt: '2026-10-20T12:20:00+08:00' },
    { id: 'dinner', title: 'Dinner record', observationKind: 'meal', savedAt: '2026-10-20T18:50:00+08:00' },
    { id: 'play', title: 'Morning play', observationKind: 'play', savedAt: '2026-10-21T10:30:00+08:00' },
  ];
  const breakfastIdentity = activitySummaryIdentity(records[0]);

  assert.deepEqual(activityCategoryRecords(records, breakfastIdentity).map(record => record.id), ['breakfast', 'lunch', 'dinner']);
  assert.equal(activityCategoryLabel(breakfastIdentity.kind), 'Feeding');
  assert.equal(activityCategoryRecords(records, activitySummaryIdentity(records[3])).length, 1);
});

test('historical totals stop at the selected day and daily totals use that day', () => {
  const records = [
    { id: 'yesterday', title: 'Breakfast record', observationKind: 'meal', savedAt: '2026-10-20T08:00:00+08:00' },
    { id: 'today', title: 'Breakfast record', observationKind: 'meal', savedAt: '2026-10-21T08:00:00+08:00' },
  ];
  const selectedYesterday = new Date(2026, 9, 20);
  const selectedToday = new Date(2026, 9, 21);

  assert.deepEqual(activityRecordsThroughDate(records, selectedYesterday).map(record => record.id), ['yesterday']);
  assert.deepEqual(activityRecordsThroughDate(records, selectedToday).map(record => record.id), ['yesterday', 'today']);
  assert.deepEqual(activityRecordsOnDate(records, selectedYesterday).map(record => record.id), ['yesterday']);
});

test('seven-day trend window ends on the selected date', () => {
  const yesterday = activitySummaryDateWindow(new Date(2026, 9, 20));
  const today = activitySummaryDateWindow(new Date(2026, 9, 21));
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  assert.deepEqual(yesterday.map(dateKey), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
  assert.deepEqual(today.map(dateKey), ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']);
});

test('weekly comparison uses selected-date windows and reports only recorded metrics', () => {
  const records = [
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-08T08:00:00+08:00', metrics: { durationMinutes: 6, consumedGrams: 150 } },
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-10T08:00:00+08:00', metrics: { durationMinutes: 8, consumedGrams: 155 } },
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-14T08:00:00+08:00', metrics: { durationMinutes: 10, consumedGrams: 160 } },
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-15T08:00:00+08:00', metrics: { durationMinutes: 7, consumedGrams: 155 } },
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-20T08:00:00+08:00', metrics: { durationMinutes: 9, consumedGrams: 160 } },
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-21T08:00:00+08:00', metrics: { durationMinutes: 8 } },
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-22T08:00:00+08:00', metrics: { durationMinutes: 99 } },
  ];
  const comparison = compareActivityWeeks(records, new Date(2026, 9, 21));

  assert.equal(comparison.canCompare, true);
  assert.equal(comparison.previous.recordCount, 3);
  assert.equal(comparison.previous.durationMinutes, 24);
  assert.equal(comparison.previous.averageDurationMinutes, 8);
  assert.equal(comparison.current.recordCount, 3);
  assert.equal(comparison.current.durationMinutes, 24);
  assert.equal(comparison.current.consumedGrams, 315);
  assert.equal(comparison.current.durationRecordCount, 3);
});

test('weekly comparison stays unavailable until both windows cover at least three recorded days', () => {
  const records = [
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-14T08:00:00+08:00' },
    { title: 'Breakfast', observationKind: 'meal', savedAt: '2026-10-21T08:00:00+08:00' },
  ];
  assert.equal(compareActivityWeeks(records, new Date(2026, 9, 21)).canCompare, false);
});

test('separates play and walk summaries by the record time of day', () => {
  const morningPlay = activitySummaryIdentity({ title: 'Morning play', observationKind: 'play', savedAt: '2026-10-21T10:30:00+08:00' });
  const afternoonPlay = activitySummaryIdentity({ title: 'Indoor play', observationKind: 'play', savedAt: '2026-10-20T16:00:00+08:00' });
  const morningWalk = activitySummaryIdentity({ title: 'Morning walk', observationKind: 'walk', savedAt: '2026-10-20T07:15:00+08:00' });
  const eveningWalk = activitySummaryIdentity({ title: 'Evening walk', observationKind: 'walk', savedAt: '2026-10-20T18:20:00+08:00' });

  assert.equal(morningPlay.label, 'Morning play');
  assert.equal(afternoonPlay.label, 'Afternoon play');
  assert.notEqual(morningPlay.key, afternoonPlay.key);
  assert.notEqual(morningWalk.key, eveningWalk.key);
  assert.equal(activityPeriodFor({ savedAt: '2026-10-20T21:45:00+08:00' }), 'evening');
});

test('keeps afternoon rest and night rest separate', () => {
  const afternoon = activitySummaryIdentity({ title: 'Afternoon rest', observationKind: 'rest', savedAt: '2026-10-20T13:45:00+08:00' });
  const night = activitySummaryIdentity({ title: 'Night rest', observationKind: 'rest', savedAt: '2026-10-20T21:45:00+08:00' });

  assert.equal(afternoon.label, 'Afternoon rest');
  assert.equal(night.label, 'Night rest');
  assert.notEqual(afternoon.key, night.key);
});
