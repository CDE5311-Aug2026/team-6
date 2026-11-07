/** Keep care semantics independent of a caregiver's editable display title. */
export function storyActivity(title: string, kind?: string, metrics?: Record<string, number>): string {
  const labels: Record<string, string> = { meal: 'Meal', water: 'Water', 'water-refill': 'Refilled water', walk: 'Walk', play: 'Play', rest: 'Rest', toilet: 'Toilet', grooming: 'Grooming', training: 'Training' };
  if (kind && labels[kind]) return labels[kind];
  if (metrics?.foodGrams !== undefined) return 'Meal';
  if (metrics?.waterMilliliters !== undefined) return 'Water';
  return ['Meal', 'Water', 'Refilled water', 'Walk', 'Play', 'Rest', 'Toilet', 'Grooming', 'Training'].includes(title) ? title : '';
}
export function storyActivityKind(activity: string): string | undefined {
  return activity === 'Refilled water' ? 'water-refill' : activity ? activity.toLowerCase() : undefined;
}
