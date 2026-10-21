export type ActivityPeriod = 'morning' | 'afternoon' | 'evening';

export type ActivitySummaryIdentity = {
  key: string;
  label: string;
  kind: string;
  defaultPeriod: ActivityPeriod;
};

export type ActivitySummaryRecord = {
  title: string;
  observationKind?: string;
  savedAt: string;
  metrics?: Record<string, number>;
};

export type ActivityWeekStats = {
  startDate: Date;
  endDate: Date;
  recordCount: number;
  daysWithRecords: number;
  durationMinutes: number;
  durationRecordCount: number;
  averageDurationMinutes: number | null;
  consumedGrams: number;
  consumptionRecordCount: number;
};

export type WeeklyInsightCandidate = {
  key: 'duration' | 'food';
  label: string;
  current: number;
  previous: number;
  unit: string;
  relativeChange: number;
  absoluteChange: number;
};

export type RankedDailyActivityInsight = WeeklyInsightCandidate & {
  activityKey: string;
  activityLabel: string;
  meetsThreshold: boolean;
  currentDays: number;
  baselineDays: number;
  currentSampleSize: number;
  baselineSampleSize: number;
  currentDate: Date;
  baselineStartDate: Date;
  baselineEndDate: Date;
};

export function selectWeeklyInsight(current: ActivityWeekStats, previous: ActivityWeekStats): WeeklyInsightCandidate | null {
  const candidates: WeeklyInsightCandidate[] = [];
  const add = (candidate: Omit<WeeklyInsightCandidate, 'relativeChange' | 'absoluteChange'>, minimumAbsoluteChange: number, minimumRelativeChange: number) => {
    if (candidate.previous <= 0 || candidate.current <= 0) return;
    const absoluteChange = candidate.current - candidate.previous;
    const relativeChange = absoluteChange / candidate.previous;
    if (Math.abs(absoluteChange) >= minimumAbsoluteChange && Math.abs(relativeChange) >= minimumRelativeChange) {
      candidates.push({ ...candidate, absoluteChange, relativeChange });
    }
  };

  if (current.durationRecordCount >= 3 && previous.durationRecordCount >= 3) {
    add({ key: 'duration', label: 'Average duration per record', current: current.durationMinutes / current.durationRecordCount, previous: previous.durationMinutes / previous.durationRecordCount, unit: 'min/record' }, 1, 0.1);
  }
  if (current.consumptionRecordCount >= 3 && previous.consumptionRecordCount >= 3) {
    add({ key: 'food', label: 'Average food per record', current: current.consumedGrams / current.consumptionRecordCount, previous: previous.consumedGrams / previous.consumptionRecordCount, unit: 'g/record' }, 15, 0.1);
  }

  return candidates.sort((a, b) => Math.abs(b.relativeChange) - Math.abs(a.relativeChange))[0] ?? null;
}

export function compareActivityWeeks<T extends ActivitySummaryRecord>(records: T[], referenceDate: Date) {
  const currentEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + 1);
  const currentStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() - 6);
  const previousEnd = currentStart;
  const previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 7);
  const summarize = (startDate: Date, endExclusive: Date): ActivityWeekStats => {
    const entries = records.filter(record => {
      const date = new Date(record.savedAt);
      return date >= startDate && date < endExclusive;
    });
    const durationEntries = entries.filter(entry => Number(entry.metrics?.durationMinutes) > 0);
    const consumptionEntries = entries.filter(entry => Number(entry.metrics?.consumedGrams) > 0);
    const daysWithRecords = new Set(entries.map(entry => {
      const date = new Date(entry.savedAt);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    })).size;
    const durationMinutes = durationEntries.reduce((total, entry) => total + Number(entry.metrics?.durationMinutes), 0);
    const endDate = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate() - 1);
    return {
      startDate: new Date(startDate),
      endDate,
      recordCount: entries.length,
      daysWithRecords,
      durationMinutes,
      durationRecordCount: durationEntries.length,
      averageDurationMinutes: durationEntries.length ? Math.round(durationMinutes / durationEntries.length) : null,
      consumedGrams: consumptionEntries.reduce((total, entry) => total + Number(entry.metrics?.consumedGrams), 0),
      consumptionRecordCount: consumptionEntries.length,
    };
  };
  const current = summarize(currentStart, currentEnd);
  const previous = summarize(previousStart, previousEnd);
  return { current, previous, canCompare: current.daysWithRecords >= 3 && previous.daysWithRecords >= 3 };
}

export function rankDailyActivityInsights<T extends ActivitySummaryRecord>(records: T[], referenceDate: Date): RankedDailyActivityInsight[] {
  const currentDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);
  const baselineEndDate = new Date(currentDate);
  const groups = new Map<string, { label: string; records: T[] }>();
  records.forEach(record => {
    const identity = activitySummaryIdentity(record);
    const group = groups.get(identity.key) ?? { label: identity.label, records: [] };
    group.records.push(record);
    groups.set(identity.key, group);
  });

  const compareMetric = (groupRecords: T[], metric: 'durationMinutes' | 'consumedGrams', key: 'duration' | 'food', label: string, unit: string, minimumAbsoluteChange: number) => {
    const metricValue = (record: T) => Number(record.metrics?.[metric]) || 0;
    const currentEntries = groupRecords.filter(record => {
      const date = new Date(record.savedAt);
      return date >= currentDate && date < nextDate && date <= referenceDate && metricValue(record) > 0;
    });
    if (!currentEntries.length) return null;

    const baselineByDay = new Map<string, number[]>();
    groupRecords.forEach(record => {
      const date = new Date(record.savedAt);
      if (!(date < baselineEndDate) || metricValue(record) <= 0) return;
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const values = baselineByDay.get(dayKey) ?? [];
      values.push(metricValue(record));
      baselineByDay.set(dayKey, values);
    });
    if (baselineByDay.size < 3) return null;

    const baselineDates = [...baselineByDay.keys()].map(dayKey => {
      const [year, month, day] = dayKey.split('-').map(Number);
      return new Date(year, month, day);
    }).sort((left, right) => left.getTime() - right.getTime());
    const dailyAverages = [...baselineByDay.values()].map(values => values.reduce((sum, value) => sum + value, 0) / values.length);
    const currentAverage = currentEntries.reduce((sum, record) => sum + metricValue(record), 0) / currentEntries.length;
    const baselineAverage = dailyAverages.reduce((sum, value) => sum + value, 0) / dailyAverages.length;
    if (baselineAverage <= 0) return null;
    const absoluteChange = currentAverage - baselineAverage;
    const relativeChange = absoluteChange / baselineAverage;
    if (absoluteChange === 0) return null;
    const baselineSampleSize = [...baselineByDay.values()].reduce((sum, values) => sum + values.length, 0);
    return {
      key,
      label,
      current: currentAverage,
      previous: baselineAverage,
      unit,
      absoluteChange,
      relativeChange,
      meetsThreshold: Math.abs(absoluteChange) >= minimumAbsoluteChange && Math.abs(relativeChange) >= 0.1,
      currentSampleSize: currentEntries.length,
      baselineSampleSize,
      currentDays: 1,
      baselineDays: baselineByDay.size,
      baselineStartDate: baselineDates[0],
    };
  };

  return [...groups.entries()].flatMap(([activityKey, group]) => {
    const insights = [
      compareMetric(group.records, 'durationMinutes', 'duration', 'Average duration per record', 'min/record', 1),
      compareMetric(group.records, 'consumedGrams', 'food', 'Average food per record', 'g/record', 15),
    ].filter((insight): insight is NonNullable<typeof insight> => insight !== null);
    const selected = insights.sort((left, right) => Number(right.meetsThreshold) - Number(left.meetsThreshold) || Math.abs(right.relativeChange) - Math.abs(left.relativeChange))[0];
    return selected ? [{
      ...selected,
      activityKey,
      activityLabel: group.label,
      currentDate,
      baselineEndDate: new Date(baselineEndDate.getFullYear(), baselineEndDate.getMonth(), baselineEndDate.getDate() - 1),
    }] : [];
  }).sort((left, right) => Number(right.meetsThreshold) - Number(left.meetsThreshold) || Math.abs(right.relativeChange) - Math.abs(left.relativeChange)).slice(0, 3);
}

export function activityRecordsThroughDate<T extends ActivitySummaryRecord>(records: T[], referenceDate: Date) {
  const exclusiveEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + 1);
  return records.filter(record => new Date(record.savedAt) < exclusiveEnd);
}

export function activityRecordsOnDate<T extends ActivitySummaryRecord>(records: T[], referenceDate: Date) {
  return records.filter(record => {
    const savedAt = new Date(record.savedAt);
    return savedAt.getFullYear() === referenceDate.getFullYear()
      && savedAt.getMonth() === referenceDate.getMonth()
      && savedAt.getDate() === referenceDate.getDate();
  });
}

export function activitySummaryDateWindow(referenceDate: Date, count = 7) {
  return Array.from({ length: count }, (_, index) => new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - count + 1 + index,
  ));
}

export function activityPeriodFor(record: Pick<ActivitySummaryRecord, 'savedAt'>): ActivityPeriod {
  const hour = new Date(record.savedAt).getHours();
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
}

function inferredKind(record: ActivitySummaryRecord) {
  if (record.observationKind) return record.observationKind;
  const title = record.title.toLowerCase();
  if (/breakfast|lunch|dinner|food|feed|meal|bowl/.test(title)) return 'meal';
  if (/walk|stroll|outdoor|potty/.test(title)) return 'walk';
  if (/play|fetch|toy|tug|chase|game/.test(title)) return 'play';
  if (/rest|sleep|nap|settling|mat/.test(title)) return 'rest';
  return 'activity';
}

function displayTitle(title: string) {
  const cleaned = title.trim().replace(/[\s-]+/g, ' ').replace(/\s+(record|observation)$/i, '').trim();
  return cleaned ? cleaned.replace(/\b\w/g, letter => letter.toUpperCase()) : 'Activity';
}

export function activitySummaryIdentity(record: ActivitySummaryRecord): ActivitySummaryIdentity {
  const kind = inferredKind(record);
  const title = record.title.toLowerCase();
  const timePeriod = activityPeriodFor(record);

  if (kind === 'meal') {
    const meal = /\bbreakfast\b|morning\s+(meal|feed|feeding)/.test(title) ? 'breakfast'
      : /\blunch\b|midday\s+(meal|feed|feeding)/.test(title) ? 'lunch'
        : /\bdinner\b|\bsupper\b|evening\s+(meal|feed|feeding)/.test(title) ? 'dinner' : null;
    if (meal) {
      const defaultPeriod = meal === 'breakfast' ? 'morning' : meal === 'lunch' ? 'afternoon' : 'evening';
      return { key: `meal:${meal}`, label: meal[0].toUpperCase() + meal.slice(1), kind, defaultPeriod };
    }
    return { key: 'meal:other', label: 'Meal', kind, defaultPeriod: timePeriod };
  }

  if (kind === 'walk' || kind === 'play' || kind === 'rest') {
    const titlePeriod = /\bmorning\b/.test(title) ? 'morning'
      : /\bafternoon\b/.test(title) ? 'afternoon'
        : /\b(evening|night)\b/.test(title) ? 'evening' : timePeriod;
    const activity = kind === 'rest' && titlePeriod === 'evening' ? 'Night rest'
      : `${titlePeriod[0].toUpperCase() + titlePeriod.slice(1)} ${kind}`;
    return {
      key: `${kind}:${titlePeriod}`,
      label: activity,
      kind,
      defaultPeriod: titlePeriod,
    };
  }

  const label = displayTitle(record.title);
  return { key: `${kind}:${label.toLowerCase()}`, label, kind, defaultPeriod: timePeriod };
}

export function activityCategoryRecords<T extends ActivitySummaryRecord>(records: T[], selected: ActivitySummaryIdentity) {
  const broadKinds = new Set(['meal', 'walk', 'play', 'rest']);
  return records.filter(record => {
    const identity = activitySummaryIdentity(record);
    return broadKinds.has(selected.kind) ? identity.kind === selected.kind : identity.key === selected.key;
  });
}

export function activityCategoryLabel(kind: string) {
  return kind === 'meal' ? 'Feeding' : kind === 'walk' ? 'Walk' : kind === 'play' ? 'Play' : kind === 'rest' ? 'Sleeping' : 'Activity';
}
