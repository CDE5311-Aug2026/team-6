import type { CareTask, CareTaskEvent } from './careTasks';

export type InboxCategory = 'care' | 'social' | 'pet';
export type LikeEvent = { actorId: string; createdAt: string };
type Moment = { id: string; title: string; note: string; savedAt: string; authorId?: string; authorName?: string; privateRecord: boolean; synthetic?: boolean };
type Context = { id: string; momentId: string; note: string; savedAt: string; authorId?: string; authorName?: string; likes?: string[]; likeEvents?: LikeEvent[]; comments?: { id: string; authorId: string; authorName: string; body: string; createdAt: string }[] };
export type InboxSpace = {
  id: string; name: string; avatar: string;
  workspace: {
    careTasks: CareTask[]; observations: Moment[]; contexts: Context[];
    careMembers: { id: string; name: string; avatar?: string }[];
    momentEngagement: Record<string, { likes: string[]; likeEvents?: LikeEvent[] }>;
    lifeEvents: { id: string; title: string; note: string; savedAt: string; authorId?: string; authorName?: string }[];
  };
};
export type InboxMessage = {
  id: string; petId: string; petName: string; petAvatar: string;
  category: InboxCategory; title: string; body: string; createdAt: string;
  actorName: string; actorAvatar?: string; needsResponse?: boolean; read: boolean;
  task?: CareTask; event?: CareTaskEvent; momentId?: string;
  invitationId?: string;
  assigneeName?: string;
  demo?: boolean;
};

/** Only data from the account's permitted pet workspaces enters the inbox. */
export function buildInbox(spaces: InboxSpace[], userId: string, readIds: string[], now = new Date()): InboxMessage[] {
  const read = new Set(readIds);
  const messages: InboxMessage[] = [];
  for (const pet of spaces) {
    const { workspace: w } = pet;
    const person = (id?: string) => id === userId ? 'You' : id === 'simulation' ? 'Pawsona simulation' : w.careMembers.find(m => m.id === id)?.name ?? 'A caregiver';
    const add = (key: string, actorId: string | undefined, value: Omit<InboxMessage, 'id' | 'petId' | 'petName' | 'petAvatar' | 'read'>) => {
      if (actorId === userId || !Number.isFinite(Date.parse(value.createdAt)) || Date.parse(value.createdAt) > +now) return;
      const id = `${pet.id}:${key}`;
      messages.push({ ...value, id, petId: pet.id, petName: pet.name, petAvatar: pet.avatar, read: read.has(id), actorAvatar: w.careMembers.find(m => m.id === actorId)?.avatar });
    };
    for (const task of w.careTasks) for (const event of task.events ?? []) {
      const actor = person(event.actorId);
      const target = event.targetId === userId ? 'you' : person(event.targetId);
      const action = /^(feed|walk|play|give|refill|clean|check|brush|change)\b/i.test(task.title)
        ? task.title.charAt(0).toLowerCase() + task.title.slice(1) : `take care of ${task.title}`;
      const titles: Record<CareTaskEvent['type'], string> = {
        assigned: `${actor} assigned ${action} to ${target}.`,
        requested: `${actor} asked ${target} to ${action}.`,
        reassigned: `${actor} asked ${target} to take over “${task.title}”.`,
        accepted: `${actor} accepted “${task.title}”.`, declined: `${actor} couldn’t help with “${task.title}”.`,
        released: `${actor} stepped back from “${task.title}”.`, taken_over: `${actor} took over “${task.title}”.`,
        completed: `${actor} completed “${task.title}”.`, reopened: `${actor} reopened “${task.title}”.`,
        skipped: `${actor} marked “${task.title}” as not today.`, restored: `${actor} added “${task.title}” back.`,
        auto_completed: `“${task.title}” was recorded in the simulation.`, reminded: `${actor} sent ${target} a reminder: ${task.title}.`,
      };
      add(`task:${event.id}`, event.actorId, {
        category: 'care', title: titles[event.type], body: task.requestNote || task.note || 'Open to review the care details.',
        createdAt: event.createdAt, actorName: actor, task, event, assigneeName: person(task.assignedTo),
        needsResponse: task.status === 'requested' && task.assignedTo === userId && task.events?.at(-1)?.id === event.id,
      });
    }
    const moments = w.observations.filter(m => !m.privateRecord);
    for (const moment of moments) {
      add(`moment:${moment.id}`, moment.synthetic ? 'simulation' : moment.authorId, { category: 'pet', title: moment.synthetic ? `${pet.name} has a new simulated moment.` : `${moment.authorName || person(moment.authorId)} shared “${moment.title}”.`, body: moment.note || moment.title, actorName: moment.synthetic ? 'Pawsona simulation' : moment.authorName || person(moment.authorId), createdAt: moment.savedAt, momentId: moment.id });
      const engagement = w.momentEngagement[moment.id];
      for (const like of engagement?.likeEvents ?? []) if (engagement.likes.includes(like.actorId)) {
        add(`moment-like:${moment.id}:${like.actorId}:${like.createdAt}`, like.actorId, { category: 'social', title: `${person(like.actorId)} liked “${moment.title}”.`, body: `A little love for ${pet.name}’s day.`, actorName: person(like.actorId), createdAt: like.createdAt, momentId: moment.id });
      }
    }
    for (const context of w.contexts) {
      // Do not expose notes, comments or likes attached to private/hidden records.
      if (!moments.some(m => m.id === context.momentId)) continue;
      add(`context:${context.id}`, context.authorId, { category: 'social', title: `${context.authorName || person(context.authorId)} added context.`, body: context.note, actorName: context.authorName || person(context.authorId), createdAt: context.savedAt, momentId: context.momentId });
      for (const comment of context.comments ?? []) add(`comment:${comment.id}`, comment.authorId, { category: 'social', title: `${comment.authorName} left a comment.`, body: comment.body, actorName: comment.authorName, createdAt: comment.createdAt, momentId: context.momentId });
      for (const like of context.likeEvents ?? []) if (context.likes?.includes(like.actorId)) add(`context-like:${context.id}:${like.actorId}:${like.createdAt}`, like.actorId, { category: 'social', title: `${person(like.actorId)} liked a context note.`, body: context.note, actorName: person(like.actorId), createdAt: like.createdAt, momentId: context.momentId });
    }
    for (const event of w.lifeEvents) add(`life:${event.id}`, event.authorId, { category: 'pet', title: `${event.authorName || person(event.authorId)} added ${event.title.toLowerCase()}.`, body: event.note, actorName: event.authorName || person(event.authorId), createdAt: event.savedAt });
  }
  return messages.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}

export function taskAdvice(task: CareTask) {
  const time = new Date(task.dueAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
  const amount = `${task.requestNote ?? ''} ${task.note}`.match(/\b\d+(?:\.\d+)?\s*(?:g|grams?|ml)\b/i)?.[0];
  const meal = /feed|breakfast|dinner|lunch|meal|food/i.test(task.title);
  return {
    time, amount,
    text: meal
      ? `Aim for the planned time, around ${time}.${amount ? ` The task instructions mention ${amount}; confirm the usual portion before serving.` : ' No portion is specified. Check the feeding instructions with your caregiver before serving.'} Check recent records first to avoid feeding twice.`
      : `Plan for around ${time}. Check the latest records and task status before you start, then mark the task complete once it is done.`,
  };
}
