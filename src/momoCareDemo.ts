import schedule from '../fixtures/momo-care-day.json';
import type { CareTask } from './careTasks';

export type MomoCareDemo = { version: 1; initialized?: boolean; seededDates?: string[] };
type Member = { id: string; name: string; role: string; detail: string; access?: 'editor' | 'viewer'; expiresAt?: string };
type Observation = { id: string; title: string; note: string; image: string; momentCount: number; context: string; privateRecord: boolean; savedAt: string };
type Workspace = { momoCareDemo?: MomoCareDemo; careMembers: Member[]; careTasks: CareTask[]; observations: Observation[]; visibility: string[] | null };
const stamp = (day: string, clock: string) => `${day}T${clock}:00+08:00`;
const event = (task: CareTask, type: 'requested' | 'accepted' | 'completed', actorId: string, targetId: string, createdAt: string) => ({ id: `${task.id}-${type}-${createdAt}`, type, actorId, targetId, createdAt });

/** A per-owner simulation; it creates no Auth identity or real group access. */
export function advanceMomoCareDemo<W extends Workspace>(workspace: W, ownerId: string, now: Date, mediaBase = '/'): W {
  if (workspace.momoCareDemo?.version !== 1 || !Number.isFinite(+now)) return workspace;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const memberId = `momo-demo-alex-${ownerId}`;
  const config = workspace.momoCareDemo;
  let members = workspace.careMembers;
  let tasks = workspace.careTasks;
  let observations = workspace.observations;
  let visibility = workspace.visibility;
  let nextConfig = config;
  if (!config.initialized) {
    if (!members.some(m => m.id === memberId)) members = [...members, { id: memberId, name: schedule.caregiverName, role: 'Caregiver', access: 'editor', detail: 'Simulated caregiver for user testing; no real account.' }];
    nextConfig = { ...config, initialized: true };
  }
  const member = members.find(m => m.id === memberId);
  // Removing or restricting the simulated member stops all further actions.
  if (!member || member.access === 'viewer' || member.role === 'Viewer' || (member.expiresAt && member.expiresAt < day)) {
    return nextConfig === config ? workspace : { ...workspace, careMembers: members, momoCareDemo: nextConfig };
  }
  if (!(config.seededDates ?? []).includes(day)) {
    const createdAt = stamp(day, '00:00');
    const planned: CareTask[] = schedule.slots.map(slot => {
      const task: CareTask = { id: `${memberId}-${day}-${slot.slot}`, demoSlot: slot.slot, title: slot.title, note: 'Demo care plan. Alex will add a simulated photo and note after completion.', dueAt: stamp(day, slot.start), windowEndAt: stamp(day, slot.complete), assignedTo: memberId, assignedBy: ownerId, status: 'accepted', createdAt, acceptedAt: createdAt, occurrenceDate: day };
      task.events = [event(task, 'accepted', memberId, ownerId, createdAt)];
      return task;
    });
    const handover: CareTask = { id: `${memberId}-${day}-handover`, title: 'Review Momo’s care handover', note: 'Demo request from Alex: please review today’s shared records and check what still needs care. Accept or decline this request.', dueAt: stamp(day, '20:45'), assignedTo: ownerId, assignedBy: memberId, status: 'requested', createdAt, occurrenceDate: day };
    handover.events = [event(handover, 'requested', memberId, ownerId, createdAt)];
    tasks = [...tasks, ...planned.filter(t => !tasks.some(saved => saved.id === t.id)), ...(tasks.some(t => t.id === handover.id) ? [] : [handover])];
    nextConfig = { ...nextConfig, seededDates: [...(config.seededDates ?? []), day] };
  }
  const nextTasks = tasks.map(task => {
    if (task.assignedTo !== memberId || task.status === 'done' || task.status === 'skipped' || task.status === 'declined' || task.completionOverridden || task.events?.some(e => e.type === 'reopened')) return task;
    if (task.status === 'requested') {
      const request = [...(task.events ?? [])].reverse().find(e => e.type === 'requested' || e.type === 'reassigned');
      const at = new Date(Date.parse(request?.createdAt ?? task.createdAt) + 30_000);
      if (+at > +now || !Number.isFinite(+at)) return task;
      return { ...task, status: 'accepted' as const, acceptedAt: at.toISOString(), events: [...(task.events ?? []), event(task, 'accepted', memberId, task.assignedBy, at.toISOString())] };
    }
    const slot = schedule.slots.find(s => s.slot === task.demoSlot);
    // Unscripted requests receive acceptance only: no invented evidence.
    if (!slot || task.occurrenceDate !== day || task.status !== 'accepted' || task.events?.some(e => ['requested', 'reassigned', 'released', 'taken_over'].includes(e.type))) return task;
    const completedAt = stamp(day, slot.complete);
    if (Date.parse(completedAt) > +now || Date.parse(task.acceptedAt ?? '') > +now) return task;
    const observationId = `${task.id}-record`;
    // A removed record is not recreated on a later tick.
    if (!task.sourceObservationId && !observations.some(o => o.id === observationId)) {
      const observation = { id: observationId, careTaskId: task.id, title: slot.title, note: `${slot.note} Demo record by Alex (Demo). The photo is a newly AI-generated illustration, not evidence of this event.`, image: `${mediaBase}${slot.image}`, mediaType: 'image', momentCount: 1, context: 'Fictional shared-care test scenario.', privateRecord: false, savedAt: stamp(day, slot.start), observedAt: stamp(day, slot.start), endedAt: completedAt, recordedAt: completedAt, authorId: memberId, authorName: schedule.caregiverName, sourceKind: 'caregiver', synthetic: true, observationKind: slot.kind, metrics: slot.metrics, ...(slot.kind === 'meal' ? { foodType: 'Usual dry kibble' } : {}) };
      observations = [...observations, observation];
      if (visibility) visibility = [...visibility, observationId];
    }
    return { ...task, status: 'done' as const, completedAt, completedBy: memberId, completedByName: schedule.caregiverName, sourceObservationId: observationId, events: [...(task.events ?? []), event(task, 'completed', memberId, ownerId, completedAt)] };
  });
  if (nextTasks.some((t, i) => t !== tasks[i])) tasks = nextTasks;
  if (members === workspace.careMembers && tasks === workspace.careTasks && observations === workspace.observations && nextConfig === config) return workspace;
  return { ...workspace, momoCareDemo: nextConfig, careMembers: members, careTasks: tasks, observations, visibility };
}
