export type CareTaskStatus = 'open' | 'requested' | 'accepted' | 'declined' | 'done' | 'skipped';

export type CareTaskEventType = 'assigned' | 'requested' | 'reassigned' | 'accepted' | 'declined' | 'released' | 'taken_over' | 'completed' | 'reopened' | 'skipped' | 'restored' | 'auto_completed';

export type CareTaskEvent = {
  id: string;
  type: CareTaskEventType;
  actorId: string;
  targetId?: string;
  createdAt: string;
  readBy?: string[];
};

export type CareTask = {
  id: string;
  title: string;
  note: string;
  dueAt: string;
  assignedTo: string;
  assignedBy: string;
  status: CareTaskStatus;
  createdAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  declinedBy?: string;
  completedAt?: string;
  completedBy?: string;
  sourcePatternId?: string;
  sourceObservationId?: string;
  occurrenceDate?: string;
  autoCompleted?: boolean;
  skippedAt?: string;
  skippedBy?: string;
  requestNote?: string;
  events?: CareTaskEvent[];
};

type CarePattern = {
  id: string;
  status: string;
  activity?: string;
  startMinute?: number;
  endMinute?: number;
};

type SimulatedActivity = {
  id: string;
  title: string;
  note: string;
  savedAt: string;
  synthetic?: boolean;
  simulationKey?: string;
};

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function clockMinute(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function isSameLocalDay(value: string, comparison: Date) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && localDayKey(date) === localDayKey(comparison);
}

export function appendCareTaskEvent(task: CareTask, event: Omit<CareTaskEvent, 'id'>): CareTask {
  const events = task.events ?? [];
  return {
    ...task,
    events: [...events, { ...event, id: `${task.id}-${event.type}-${event.createdAt}-${events.length}` }],
  };
}

export function markCareTaskEventsRead(tasks: CareTask[], userId: string): CareTask[] {
  let changed = false;
  const next = tasks.map((task) => {
    if (!task.events?.some((event) => event.targetId === userId && !(event.readBy ?? []).includes(userId))) return task;
    changed = true;
    return {
      ...task,
      events: task.events.map((event) => event.targetId === userId && !(event.readBy ?? []).includes(userId)
        ? { ...event, readBy: [...(event.readBy ?? []), userId] }
        : event),
    };
  });
  return changed ? next : tasks;
}

export function careTaskInboxCount(tasks: CareTask[], userId: string, isPrimary: boolean): number {
  const needsAttention = tasks.filter((task) => (task.status === 'requested' && task.assignedTo === userId) || (isPrimary && task.status === 'declined')).length;
  const unread = tasks.flatMap((task) => task.events ?? []).filter((event) => event.targetId === userId && event.actorId !== userId && !(event.readBy ?? []).includes(userId)).length;
  return Math.max(needsAttention, unread);
}

function completeWhenRecorded(task: CareTask, now: Date): CareTask {
  if (task.status === 'skipped' || task.status === 'done' || new Date(task.dueAt).getTime() > now.getTime()) return task;
  const completed: CareTask = {
    ...task,
    status: 'done',
    completedAt: task.dueAt,
    completedBy: 'simulation',
    autoCompleted: true,
  };
  if (task.events?.some((event) => event.type === 'auto_completed')) return completed;
  return appendCareTaskEvent(completed, { type: 'auto_completed', actorId: 'simulation', createdAt: task.dueAt });
}

function simulatedCareTasksForDate(observations: SimulatedActivity[], savedTasks: CareTask[], date: Date, now: Date): CareTask[] {
  return observations
    .filter((observation) => observation.synthetic === true && !!observation.simulationKey && isSameLocalDay(observation.savedAt, date))
    .map((observation) => {
      const id = `simulation-care-${observation.id}`;
      const saved = savedTasks.find((task) => task.id === id || task.sourceObservationId === observation.id);
      const generated: CareTask = {
        id,
        title: observation.title,
        note: observation.note,
        dueAt: observation.savedAt,
        assignedTo: '',
        assignedBy: 'simulation',
        status: 'open',
        createdAt: observation.savedAt,
        sourceObservationId: observation.id,
        occurrenceDate: localDayKey(date),
      };
      return completeWhenRecorded(saved ?? generated, now);
    })
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

function patternCareTasksForDate(patterns: CarePattern[], savedTasks: CareTask[], date: Date, petName: string): CareTask[] {
  const key = localDayKey(date);
  const actionableActivities = new Set(['Breakfast', 'Lunch', 'Dinner', 'Walk', 'Play']);
  return patterns
    .filter((pattern) => pattern.status === 'confirmed' && actionableActivities.has(pattern.activity ?? '') && Number.isFinite(pattern.startMinute) && Number.isFinite(pattern.endMinute) && pattern.startMinute! >= 0 && pattern.endMinute! <= 1440 && pattern.startMinute! < pattern.endMinute!)
    .map((pattern) => {
      const id = `routine-${pattern.id}-${key}`;
      const saved = savedTasks.find((task) => task.id === id || (task.sourcePatternId === pattern.id && task.occurrenceDate === key));
      const start = pattern.startMinute!;
      const due = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(start / 60), start % 60);
      const generated: CareTask = {
        id,
        title: `${petName}’s ${pattern.activity!.toLowerCase()}`,
        note: `Usual window ${clockMinute(pattern.startMinute!)}–${clockMinute(pattern.endMinute!)}`,
        dueAt: due.toISOString(),
        assignedTo: '',
        assignedBy: '',
        status: 'open',
        createdAt: date.toISOString(),
        sourcePatternId: pattern.id,
        occurrenceDate: key,
      };
      return saved ?? generated;
    })
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

/** Build the selected day's checklist from its simulation, with Pattern as a fallback. */
export function careTasksForDate(patterns: CarePattern[], observations: SimulatedActivity[], savedTasks: CareTask[], date: Date, now: Date, petName: string): CareTask[] {
  const simulated = simulatedCareTasksForDate(observations, savedTasks, date, now);
  return simulated.length ? simulated : patternCareTasksForDate(patterns, savedTasks, date, petName);
}

/** Return a declined task to the requesting caregiver without discarding the request history. */
export function takeOverDeclinedCareTask(task: CareTask, currentUserId: string): CareTask {
  if (task.status !== 'declined') return task;
  return {
    ...task,
    assignedTo: currentUserId,
    assignedBy: currentUserId,
    status: 'open',
    acceptedAt: undefined,
  };
}

/** Let the assigned caregiver step back while retaining when they originally accepted. */
export function releaseAcceptedCareTask(task: CareTask, currentUserId: string, declinedAt: string): CareTask {
  if (task.status !== 'accepted' || task.assignedTo !== currentUserId) return task;
  return {
    ...task,
    status: 'declined',
    declinedBy: currentUserId,
    declinedAt,
  };
}

export function isObservationSkippedForToday(observation: Pick<SimulatedActivity, 'id'>, tasks: CareTask[]) {
  return tasks.some((task) => task.sourceObservationId === observation.id && task.status === 'skipped');
}
