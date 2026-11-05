import type { CareTask } from './careTasks';
import { buildInbox, type InboxMessage, type InboxSpace } from './inboxModel';

export type InboxDemoState = { version: 1; startedAt: string; response?: 'accepted' | 'declined'; respondedAt?: string };

// Existing accounts and guests must not receive the registration examples.
export const INBOX_EXAMPLES_ROLLOUT_AT = '2026-11-05T15:28:18Z';
export function inboxExamplesForCreatedAt(createdAt?: string) {
  return !!createdAt && Number.isFinite(Date.parse(createdAt)) && Date.parse(createdAt) >= Date.parse(INBOX_EXAMPLES_ROLLOUT_AT);
}

/** Private, fictional test messages. Never adds members or tasks to a real care group. */
export function buildInboxDemo(pet: { id: string; name: string; avatar: string }, userId: string, state: InboxDemoState, readIds: string[], now = new Date()): InboxMessage[] {
  const start = new Date(state.startedAt);
  if (!Number.isFinite(+start)) return [];
  const stamp = (minutes: number) => new Date(+start - minutes * 60000).toISOString();
  const due = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (start.getHours() >= 8 ? 1 : 0), 8);
  const prefix = `inbox-demo-${userId}-${pet.id}`;
  const mom = `${prefix}-mom`;
  const dad = `${prefix}-dad`;
  const feeding: CareTask = {
    id: `${prefix}-feed`, title: `Feed ${pet.name}`, note: 'Around 8 AM, serve 200g of the usual food. Fresh water is in the kitchen.',
    requestNote: 'I’m leaving early. Could you take care of breakfast? The usual food is in the kitchen.',
    dueAt: due.toISOString(), assignedTo: userId, assignedBy: mom, status: state.response ?? 'requested', createdAt: stamp(2),
    ...(state.response === 'accepted' ? { acceptedAt: state.respondedAt } : state.response === 'declined' ? { declinedAt: state.respondedAt, declinedBy: userId } : {}),
    events: [{ id: `${prefix}-feed-request`, type: 'requested', actorId: mom, targetId: userId, createdAt: stamp(2) },
      ...(state.response && state.respondedAt ? [{ id: `${prefix}-feed-response`, type: state.response, actorId: userId, targetId: mom, createdAt: state.respondedAt }] : [])],
  };
  const walk: CareTask = {
    id: `${prefix}-walk`, title: `Walk ${pet.name}`, note: 'A relaxed walk along the usual route.', dueAt: stamp(35), assignedTo: dad, assignedBy: mom,
    status: 'done', createdAt: stamp(60), completedAt: stamp(8), completedBy: dad,
    events: [
      { id: `${prefix}-walk-reassigned`, type: 'reassigned', actorId: mom, targetId: dad, createdAt: stamp(55) },
      { id: `${prefix}-walk-accepted`, type: 'accepted', actorId: dad, targetId: mom, createdAt: stamp(50) },
      { id: `${prefix}-walk-completed`, type: 'completed', actorId: dad, targetId: mom, createdAt: stamp(8) },
    ],
  };
  const momentId = `${prefix}-moment`;
  const space: InboxSpace = { ...pet, workspace: {
    careTasks: [feeding, walk], careMembers: [{ id: mom, name: 'Mom' }, { id: dad, name: 'Dad' }, { id: userId, name: 'You' }],
    observations: [{ id: momentId, title: 'A happy walk in the park', note: `${pet.name} explored the park for 25 minutes.`, authorId: dad, authorName: 'Dad', savedAt: stamp(7), privateRecord: false }],
    contexts: [{ id: `${prefix}-context`, momentId, note: 'A friend joined us at the park.', authorId: dad, authorName: 'Dad', savedAt: stamp(6), comments: [{ id: `${prefix}-comment`, authorId: mom, authorName: 'Mom', body: 'Looks like a lovely walk! Thanks for taking care of things.', createdAt: stamp(4) }] }],
    momentEngagement: { [momentId]: { likes: [mom], likeEvents: [{ actorId: mom, createdAt: stamp(5) }] } }, lifeEvents: [],
  } };
  return buildInbox([space], userId, readIds, now).map(message => ({ ...message, demo: true }));
}

export function isInboxDemoTask(taskId: string, petId: string, userId: string) {
  return taskId === `inbox-demo-${userId}-${petId}-feed`;
}
