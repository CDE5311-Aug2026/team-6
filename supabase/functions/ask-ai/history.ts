type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : [];
const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
export const HISTORY_LIMIT = 12000;

/** A bounded extract, not an AI memory. Never include media, private records or future data. */
export function buildHistory(workspace: Row = {}, now = new Date()) {
  const start = new Date(now.getTime() - 7 * 86400000);
  const visible = Array.isArray(workspace.visibility) ? workspace.visibility : null;
  const observations = rows(workspace.observations).filter(o => o.privateRecord !== true);
  const currentIds = new Set(observations.map(o => o.id));
  const enforceVisibility = visible !== null && (visible.length === 0 || visible.some(id => currentIds.has(id)));
  const recent = observations.filter(o => {
    const time = Date.parse(String(o.savedAt));
    return Number.isFinite(time) && time >= start.getTime() && time <= now.getTime()
      && (!enforceVisibility || visible!.includes(o.id));
  }).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  const selected = recent.slice(0, 28);
  const ids = new Set(selected.map(o => o.id));
  const contexts = rows(workspace.contexts).filter(c => ids.has(c.momentId)
    && Date.parse(String(c.savedAt)) <= now.getTime()).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))).slice(0, 8);
  const patterns = rows(workspace.patterns).filter(p => p.status === 'confirmed')
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5);
  const events = rows(workspace.lifeEvents).filter(e => e.useForAsk === true
    && typeof e.startDate === 'string' && e.startDate <= now.toISOString().slice(0, 10)
    && (e.ongoing === true || String(e.endDate || e.startDate) >= start.toISOString().slice(0, 10)))
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))).slice(0, 5);
  const result = {
    windowStart: start.toISOString(), windowEnd: now.toISOString(),
    availableRecentRecords: recent.length, includedRecords: selected.length,
    scope: 'Up to 28 public Story text records from the last 7 days, 8 linked owner contexts, 5 confirmed patterns and 5 permitted recent/ongoing life events. Partial extract; omitted records are unknown. Dates are ISO timestamps. No historical media or private notes.',
    observations: selected.map(o => ({ id: text(o.id, 80), at: text(o.savedAt, 40), title: text(o.title, 70), note: text(o.note, 160), context: text(o.context, 80), simulated: o.synthetic === true })),
    contexts: contexts.map(c => ({ momentId: text(c.momentId, 80), note: text(c.note, 120), interpretation: text(c.interpretation, 30) })),
    patterns: patterns.map(p => ({ title: text(p.title, 70), detail: text(p.detail, 160) })),
    events: events.map(e => ({ title: text(e.title, 70), start: text(e.startDate, 10), end: text(e.endDate, 10), ongoing: e.ongoing === true, note: text(e.note, 180) })),
  };
  // Bound serialized characters too (escaping and malformed imported text can expand).
  while (JSON.stringify(result).length > HISTORY_LIMIT) {
    if (result.observations.length) result.observations.pop();
    else if (result.contexts.length) result.contexts.pop();
    else if (result.events.length) result.events.pop();
    else if (result.patterns.length) result.patterns.pop();
    else break;
  }
  const retainedIds = new Set(result.observations.map(o => o.id));
  result.contexts = result.contexts.filter(c => retainedIds.has(c.momentId));
  result.includedRecords = result.observations.length;
  return JSON.stringify(result);
}
