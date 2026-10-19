export type TimedRecord = { id: string; title: string; note?: string; savedAt: string; privateRecord?: boolean; synthetic?: boolean; sourceKind?: string; authorName?: string };
export type DailyPattern = { id: string; title: string; detail: string; evidence: string; confirmedBy: string; updatedAt: string; status: 'confirmed' | 'archived'; activity?: string; startMinute?: number; endMinute?: number; sourceIds?: string[]; generatedBy?: 'AI' | 'owner'; };
export function activityFor(title: string) {
  const t = title.toLowerCase().trim();
  // A label, question, plan or missing event is not evidence of completed care.
  if (/\b(no|not|never|without|missed|missing|pending|due|upcoming|before|untouched|uneaten|skip|skipped|empty|awaiting|waiting|planned|planning|tomorrow|remind|reminder|need|needs|should|will|might|maybe|hasn.t|haven.t|didn.t|wasn.t|isn.t|yet)\b|[?？]|没|未|不|待|计划|明天|提醒/.test(t)) return null;
  if (/bowl.*\b(full|still)\b/.test(t)) return null;
  return /breakfast|morning feed/.test(t) ? 'Breakfast' : /dinner|evening feed/.test(t) ? 'Dinner' : /lunch/.test(t) ? 'Lunch' : /walk/.test(t) ? 'Walk' : /rest|nap|sleep|settling/.test(t) ? 'Rest' : /play|fetch|toy/.test(t) ? 'Play' : null;
}
export const clockMinute = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export function patternCandidates(records: TimedRecord[], now = new Date(), offset = now.getTimezoneOffset()) {
  const local = (stamp: string | number) => new Date((typeof stamp === 'number' ? stamp : Date.parse(stamp)) - offset * 60000);
  const end = local(+now).toISOString().slice(0, 10);
  const start = new Date(Date.parse(end) - 7 * 86400000).toISOString().slice(0, 10);
  const recent = [...new Map(records.filter(r => !r.privateRecord && local(r.savedAt).toString() !== 'Invalid Date' && local(r.savedAt).toISOString().slice(0, 10) >= start && local(r.savedAt).toISOString().slice(0, 10) < end).map(r => [r.id, r])).values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 100);
  const groups = new Map<string, TimedRecord[]>();
  for (const r of recent) { const activity = activityFor(`${r.title} ${r.note || ''}`); if (!activity) continue; const hour = local(r.savedAt).getUTCHours(); const key = `${activity}:${Math.floor(hour / 6)}`; groups.set(key, [...(groups.get(key) ?? []), r]); }
  return [...groups].flatMap(([key, rows]) => {
    const days = new Set(rows.map(r => local(r.savedAt).toISOString().slice(0, 10))).size;
    if (days < 3) return [];
    const minutes = rows.map(r => local(r.savedAt).getUTCHours() * 60 + local(r.savedAt).getUTCMinutes()).sort((a, b) => a - b);
    if (minutes.at(-1)! - minutes[0] > 180) return [];
    const startMinute = Math.max(0, Math.floor((minutes[0] - 15) / 15) * 15);
    const endMinute = Math.min(1439, Math.ceil((minutes.at(-1)! + 15) / 15) * 15);
    return [{ key, activity: key.split(':')[0], title: `${key.split(':')[0]} · ${clockMinute(startMinute)}–${clockMinute(endMinute)}`, startMinute, endMinute, days, count: rows.length, sourceIds: rows.map(r => r.id), evidence: `${rows.length} records on ${days} days, ${start} to ${end} (end excluded). Record times, not health advice.` }];
  }).slice(0, 8);
}

export function dailyChecks(patterns: DailyPattern[], records: TimedRecord[], now = new Date()) {
  const today = now.toDateString(), minute = now.getHours() * 60 + now.getMinutes();
  const todays = records.filter(r => !r.privateRecord && Date.parse(r.savedAt) <= +now && new Date(r.savedAt).toDateString() === today);
  return patterns.filter(p => p.status === 'confirmed' && p.activity && Number.isFinite(p.startMinute) && Number.isFinite(p.endMinute)).map(pattern => {
    const matches = todays.filter(r => activityFor(`${r.title} ${r.note || ''}`) === pattern.activity && new Date(r.savedAt).getHours() * 60 + new Date(r.savedAt).getMinutes() >= Math.max(0, pattern.startMinute! - 120) && new Date(r.savedAt).getHours() * 60 + new Date(r.savedAt).getMinutes() <= Math.min(1439, pattern.endMinute! + 180));
    const record = matches.sort((a, b) => a.savedAt.localeCompare(b.savedAt))[0];
    return { pattern, record, state: record ? 'recorded' : minute >= pattern.startMinute! + Math.floor((pattern.endMinute! - pattern.startMinute!) * .75) ? 'check' : 'upcoming' };
  });
}
