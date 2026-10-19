export type RoutineRecord = { id: string; title: string; savedAt: string; privateRecord: boolean; synthetic?: boolean };
/** Descriptive clock-time groups only; never infer duration, emotion or a health baseline. */
export function summarizeRoutine(records: RoutineRecord[], now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end); start.setDate(start.getDate() - 7);
  const eligible = [...new Map(records.filter(r => !r.privateRecord && Date.parse(r.savedAt) >= +start && Date.parse(r.savedAt) < +end).map(r => [r.id, r])).values()];
  const recent = eligible.sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 100);
  const dayKey = (date: string) => new Date(date).toDateString();
  const days = new Set(recent.map(r => dayKey(r.savedAt))).size;
  const groups = new Map<string, RoutineRecord[]>();
  for (const record of recent) {
    const title = record.title.toLowerCase();
    const category = /breakfast|lunch|dinner|meal|feed/.test(title) ? 'Meals' : /walk/.test(title) ? 'Walks' : /rest|sleep|settling|nap/.test(title) ? 'Rest' : /play|fetch|toy/.test(title) ? 'Play' : null;
    if (category) groups.set(category, [...(groups.get(category) ?? []), record]);
  }
  const patterns = [...groups].map(([category, items]) => {
    const recordedDays = new Set(items.map(r => dayKey(r.savedAt))).size;
    const periods = [0, 0, 0, 0];
    items.forEach(r => { periods[Math.floor(new Date(r.savedAt).getHours() / 6)]++; });
    const peak = periods.indexOf(Math.max(...periods));
    return { category, count: items.length, days: recordedDays, period: ['00:00-05:59', '06:00-11:59', '12:00-17:59', '18:00-23:59'][peak] };
  }).filter(p => p.days >= 3);
  return { start, end, days, count: recent.length, capped: eligible.length > 100, simulated: recent.some(r => r.synthetic), ready: days >= 3 && recent.length >= 8, patterns };
}
