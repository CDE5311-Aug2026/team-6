type ObservationTemplate = {
  id: string;
  title: string;
  image: string;
  note?: string;
  mediaType?: string;
  observationKind?: string;
};

function inferObservationKind(observation: ObservationTemplate): string | undefined {
  if (observation.observationKind) return observation.observationKind;
  const text = `${observation.title} ${observation.note ?? ''}`.toLowerCase();
  if (/breakfast|lunch|dinner|meal|food|feed|eating|bowl/.test(text)) return 'meal';
  if (/walk|stroll|outdoor|potty/.test(text)) return 'walk';
  if (/play|game|fetch|toy|tug|chase|sniff game/.test(text)) return 'play';
  if (/rest|nap|sleep|quiet|mat|lying down/.test(text)) return 'rest';
  return undefined;
}

type PlannedActivity = {
  slot: string;
  hour: number;
  minute: number;
  title: string;
  kind: 'meal' | 'walk' | 'play' | 'rest';
  note: string;
  metrics?: Record<string, number>;
};

export type SimulatedStoryObservation = {
  id: string;
  title: string;
  note: string;
  image: string;
  mediaType?: string;
  momentCount: number;
  context: string;
  privateRecord: false;
  savedAt: string;
  authorId: string;
  authorName: string;
  synthetic: true;
  observationKind: PlannedActivity['kind'];
  simulationKey: string;
  metrics?: Record<string, number>;
};

export function isSyntheticSunnyProfile(pet: { id: string; name: string; breed: string }) {
  if (pet.id === 'pet-synthetic-sunny-20261009-v1') return true;
  const normalizedName = pet.name.trim().toLowerCase().replace(/[（(]\s*test\s*[）)]$/i, '').trim();
  const normalizedBreed = pet.breed.trim().toLowerCase().replace(/\s+/g, ' ');
  // Care-group projections can use a shared/group ID instead of the original
  // pet_id. Keep the fallback narrowly scoped to Sunny's test Golden Retriever.
  return normalizedName === 'sunny' && normalizedBreed === 'golden retriever';
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function plannedActivities(day: Date): PlannedActivity[] {
  const weekday = day.getDay(); // Sunday = 0
  const number = day.getDate();
  const variation = number % 4;
  const activities: PlannedActivity[] = [
    {
      slot: 'breakfast', hour: 8, minute: 0, title: 'Breakfast record', kind: 'meal',
      note: `Ate about ${155 + variation * 5} g of the usual food in ${7 + variation} minutes, then left the bowl.`,
      metrics: { consumedGrams: 155 + variation * 5, durationMinutes: 7 + variation },
    },
  ];

  // Weekdays have an evening walk; rest days have both morning and evening walks.
  if (weekday === 0 || weekday === 6) activities.push({
    slot: 'morning-walk', hour: 7, minute: 15, title: 'Morning walk', kind: 'walk',
    note: `Walked for about ${29 + variation * 2} minutes, with several sniffing stops along the familiar route.`,
    metrics: { durationMinutes: 29 + variation * 2 },
  });

  // Play is intentionally intermittent, not a fixed daily card.
  if (weekday === 3 || weekday === 6) activities.push({
    slot: 'morning-play', hour: 10, minute: 30, title: 'Morning play', kind: 'play',
    note: `Played a short fetch or scent game for about ${11 + variation * 2} minutes, then returned to the mat.`,
    metrics: { durationMinutes: 11 + variation * 2 },
  });

  // Lunch is an optional routine, shown twice in this sample week.
  if (weekday === 2 || weekday === 0) activities.push({
    slot: 'lunch', hour: 12, minute: 20, title: 'Lunch record', kind: 'meal',
    note: `Had a small optional midday portion of about ${65 + variation * 5} g over ${4 + variation} minutes.`,
    metrics: { consumedGrams: 65 + variation * 5, durationMinutes: 4 + variation },
  });

  activities.push({
    slot: 'afternoon-rest', hour: 13, minute: 45, title: 'Afternoon rest', kind: 'rest',
    note: `Rested intermittently on the familiar mat for about ${88 + variation * 7} minutes. Rest is not confirmed sleep.`,
    metrics: { durationMinutes: 88 + variation * 7 },
  });

  // A second play session occurs on some, but not all, days.
  if (weekday === 1 || weekday === 4 || weekday === 6) activities.push({
    slot: 'afternoon-play', hour: 16, minute: 0, title: 'Indoor play', kind: 'play',
    note: `Played fetch or a scent game for about ${10 + variation * 2} minutes, then settled on the mat.`,
    metrics: { durationMinutes: 10 + variation * 2 },
  });

  if (weekday !== 0 && weekday !== 6) activities.push({
    slot: 'evening-walk', hour: 18, minute: 20, title: 'Evening walk', kind: 'walk',
    note: `Walked for about ${30 + variation * 2} minutes at an easy pace, stopping to sniff along the usual route.`,
    metrics: { durationMinutes: 30 + variation * 2 },
  });
  else activities.push({
    slot: 'evening-walk', hour: 17, minute: 30, title: 'Evening walk', kind: 'walk',
    note: `Went for a second walk of about ${31 + variation * 2} minutes before settling at home.`,
    metrics: { durationMinutes: 31 + variation * 2 },
  });

  activities.push(
    {
      slot: 'dinner', hour: 18, minute: 50, title: 'Dinner record', kind: 'meal',
      note: `Ate about ${155 + variation * 5} g of the usual food in ${8 + variation} minutes.`,
      metrics: { consumedGrams: 155 + variation * 5, durationMinutes: 8 + variation },
    },
    {
      slot: 'night-rest', hour: 21, minute: 45, title: 'Night rest', kind: 'rest',
      note: `Settled in for the night after the usual evening routine.`,
    },
  );
  return activities;
}

/**
 * Prepare a rolling seven-day schedule plus yesterday's catch-up records.
 * Records are stable and idempotent, so reopening or refreshing the app does
 * not duplicate the plan. Their future timestamps let Story reveal each item
 * only once its scheduled time has passed.
 */
export function buildRollingStorySimulation(
  existing: Array<ObservationTemplate & {
    savedAt: string;
    synthetic?: boolean;
    simulationKey?: string;
    authorId?: string;
    authorName?: string;
    context?: string;
    momentCount?: number;
    privateRecord?: boolean;
    metrics?: Record<string, number>;
  }>,
  now: Date,
  petId: string,
  ownerId: string,
  ownerName: string,
): SimulatedStoryObservation[] {
  const templates = new Map<string, ObservationTemplate>();
  for (const observation of existing) {
    const kind = inferObservationKind(observation);
    if (observation.image && kind && !templates.has(kind)) {
      templates.set(kind, observation);
    }
  }
  const existingByKey = new Map(existing
    .filter((observation) => observation.simulationKey)
    .map((observation) => [observation.simulationKey!, observation]));
  // Older scheduled rows used a stable synthetic ID but were saved before
  // `simulationKey` was added. Index those rows by local date + title so they
  // can be repaired in place instead of duplicated by the current schedule.
  const legacySyntheticByDayAndTitle = new Map(existing
    .filter((observation) => observation.synthetic === true)
    .map((observation) => {
      const savedAt = new Date(observation.savedAt);
      return [`${localDateKey(savedAt)}|${observation.title.trim().toLowerCase()}`, observation] as const;
    }));
  const additions: SimulatedStoryObservation[] = [];
  for (let offset = -1; offset < 7; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dateKey = localDateKey(day);
    for (const activity of plannedActivities(day)) {
      const simulationKey = `${petId}:${dateKey}:${activity.slot}`;
      const existingSimulation = existingByKey.get(simulationKey)
        ?? legacySyntheticByDayAndTitle.get(`${dateKey}|${activity.title.trim().toLowerCase()}`);
      if (existingSimulation) {
        // Older runs persisted scheduled records without simulationKey or
        // media templates. Repair only synthetic rows with a blank image; keep
        // their IDs, notes, timestamps, and other caregiver-visible data.
        const template = templates.get(activity.kind);
        if (existingSimulation.synthetic && !existingSimulation.image && template?.image) {
          additions.push({
            ...existingSimulation,
            id: existingSimulation.id,
            title: existingSimulation.title,
            note: existingSimulation.note ?? '',
            image: template.image,
            mediaType: existingSimulation.mediaType || template.mediaType,
            momentCount: existingSimulation.momentCount ?? 1,
            context: existingSimulation.context ?? 'Scheduled simulated routine record.',
            privateRecord: false,
            savedAt: existingSimulation.savedAt,
            authorId: existingSimulation.authorId || ownerId,
            authorName: existingSimulation.authorName || ownerName,
            synthetic: true,
            observationKind: activity.kind,
            simulationKey,
            metrics: existingSimulation.metrics ?? activity.metrics,
          });
        }
        continue;
      }
      // Do not synthesize an activity over a caregiver's existing same-day record.
      const hasExistingActivity = existing.some((observation) => {
        if (localDateKey(new Date(observation.savedAt)) !== dateKey) return false;
        if (observation.observationKind !== activity.kind) return false;
        return observation.synthetic !== true && observation.title.toLowerCase() === activity.title.toLowerCase();
      });
      if (hasExistingActivity) continue;

      const template = templates.get(activity.kind);
      const savedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), activity.hour, activity.minute).toISOString();
      additions.push({
        id: `synthetic-${petId}-${dateKey}-${activity.slot}`,
        title: activity.title,
        note: activity.note,
        image: template?.image ?? '',
        mediaType: template?.mediaType,
        momentCount: 1,
        context: 'Scheduled simulated routine record.',
        privateRecord: false,
        savedAt,
        authorId: ownerId,
        authorName: ownerName,
        synthetic: true,
        observationKind: activity.kind,
        simulationKey,
        metrics: activity.metrics,
      });
    }
  }
  return additions;
}
