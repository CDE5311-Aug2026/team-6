type Observation = { authorId?: string; authorName?: string; synthetic?: boolean; savedAt: string; id: string };
type Pet = { sharedGroupId?: string; sharedOwnerAccountId?: string; workspace: { careTasks: { sourceObservationId?: string; status: string; completedBy?: string; completedByName?: string; autoCompleted?: boolean; assignedTo?: string }[] } };
export function observationBelongsToAccount(pet: Pet, observation: Observation, accountId: string) {
  return observation.authorId === accountId || (!observation.authorId && (!pet.sharedGroupId || pet.sharedOwnerAccountId === accountId));
}
/** My records includes personally written records as well as care personally completed. */
export function observationCompletedByAccount(pet: Pet, observation: Observation, accountId: string, accountName?: string) {
  if (!observation.synthetic && observationBelongsToAccount(pet, observation, accountId)) return true;
  const normalizedAccountName = accountName?.trim().toLocaleLowerCase();
  const task = pet.workspace.careTasks.find(entry => entry.sourceObservationId === observation.id);
  if (task?.status === 'skipped') return false;
  if (task?.status === 'done') return task.completedBy === accountId || (task.autoCompleted === true && !!normalizedAccountName && task.completedByName?.trim().toLocaleLowerCase() === normalizedAccountName);
  if (!observation.synthetic || new Date(observation.savedAt).getTime() > Date.now()) return false;
  const completerId = task?.assignedTo && ['open', 'accepted'].includes(task.status) ? task.assignedTo : observation.authorId || 'simulation';
  const completerName = completerId === (observation.authorId || 'simulation') ? observation.authorName : undefined;
  return completerId === accountId || (!observation.authorId && !!normalizedAccountName && completerName?.trim().toLocaleLowerCase() === normalizedAccountName);
}
