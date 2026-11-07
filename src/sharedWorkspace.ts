type Entry = { id?: string; momentId?: string; privateRecord?: boolean; useForAsk?: boolean; authorId?: string };
type Workspace = { observations?: Entry[]; lifeEvents?: Entry[]; contexts?: Entry[]; askMessages?: unknown[]; drafts?: unknown[]; careMembers?: unknown[]; askOwnerAccountId?: string; sharedUpdatedAt?: string };
/** All invitation and sync paths must share only explicitly public content. */
export function redactSharedWorkspace<T extends Workspace>(workspace: T): T {
  const observations = (workspace.observations ?? []).filter(o => !o.privateRecord);
  const ids = new Set(observations.map(o => o.id));
  return { ...workspace, observations, lifeEvents: (workspace.lifeEvents ?? []).filter(e => e.useForAsk === true), contexts: (workspace.contexts ?? []).filter(c => ids.has(c.momentId)), askMessages: [], drafts: [], careMembers: [], askOwnerAccountId: undefined, sharedUpdatedAt: undefined } as T;
}
/** Retain this account's personal notes without importing another member's private data. */
export function mergePrivateWorkspace<T extends Workspace>(shared: T, personal: T | undefined, accountId: string): T {
  const clean = redactSharedWorkspace(shared);
  const mine = (entry: Entry) => !entry.authorId || entry.authorId === accountId;
  const privateObservations = (personal?.observations ?? []).filter(o => o.privateRecord && mine(o));
  const privateIds = new Set(privateObservations.map(o => o.id));
  return { ...clean,
    observations: [...privateObservations, ...(clean.observations ?? [])],
    lifeEvents: [...(personal?.lifeEvents ?? []).filter(e => !e.useForAsk && mine(e)), ...(clean.lifeEvents ?? [])],
    contexts: [...(personal?.contexts ?? []).filter(c => privateIds.has(c.momentId) && mine(c)), ...(clean.contexts ?? [])],
    askMessages: personal?.askMessages ?? [], drafts: personal?.drafts ?? [], askOwnerAccountId: personal?.askOwnerAccountId,
    careMembers: shared.careMembers, sharedUpdatedAt: shared.sharedUpdatedAt,
  } as T;
}
