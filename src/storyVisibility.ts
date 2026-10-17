/**
 * Older workspace snapshots used demo-moment IDs (for example `breakfast`)
 * in the visibility list. Real observation IDs are different, so treating
 * such a stale list as authoritative would hide every observation.
 *
 * An explicit empty list still means that the caregiver hid every record.
 * When a non-empty list has no IDs in common with the observations, treat it
 * as a legacy list and show all non-private observations instead.
 */
export function visibleStoryObservations<T extends { id: string; privateRecord: boolean }>(
  observations: T[],
  includedMoments: string[] | null,
): T[] {
  const publicObservations = observations.filter((observation) => !observation.privateRecord);
  if (includedMoments === null) return publicObservations;
  if (includedMoments.length === 0) return [];

  const observationIds = new Set(publicObservations.map((observation) => observation.id));
  const hasCurrentObservationId = includedMoments.some((id) => observationIds.has(id));
  if (!hasCurrentObservationId) return publicObservations;

  const included = new Set(includedMoments);
  return publicObservations.filter((observation) => included.has(observation.id));
}
