/** Merge the current edited list into existing care-group copies by ID. */
export function mergeSharedStoryObservations<T extends { id: string; privateRecord: boolean; savedAt: string }>(
  existingCopies: T[],
  incoming: T[],
  replacedId?: string,
): T[] {
  const retained = existingCopies.filter((entry) => !entry.privateRecord && entry.id !== replacedId);
  const updates = incoming.filter((entry) => !entry.privateRecord && entry.id !== replacedId);
  const replacement = replacedId ? incoming.find((entry) => entry.id === replacedId && !entry.privateRecord) : undefined;
  return [...new Map([...retained, ...updates, ...(replacement ? [replacement] : [])].map((entry) => [entry.id, entry])).values()]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}
