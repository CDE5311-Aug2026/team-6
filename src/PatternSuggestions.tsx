import { useState } from 'react';
import { requestAskAI } from './askAI';
import { clockMinute, patternCandidates, type DailyPattern, type TimedRecord } from '../supabase/functions/_shared/dailyPatterns';

export default function PatternSuggestions({ petId, records, ownerName, existing, onSave, enabled }: { petId: string; records: TimedRecord[]; ownerName: string; existing: DailyPattern[]; onSave: (pattern: DailyPattern) => string; enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<DailyPattern[]>([]);
  const candidates = patternCandidates(records);
  async function generate() {
    setBusy(true); setError('');
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const stats = candidates.map(({ key, activity, count, days, startMinute, endMinute }) => ({ key, activity, count, days, startMinute, endMinute }));
      const answer = await requestAskAI(petId, [{ role: 'user', text: `Summarize these bounded recorded-time groups as candidate daily patterns, in English. These may include simulated records. Do not infer health, emotions, duration or missing care. Return ONLY JSON: {"summaries":[{"key":"group key","detail":"one short sentence based on the counts and time window"}]}. Statistics: ${JSON.stringify(stats)}` }], controller.signal, false);
      const parsed = JSON.parse(answer.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
      if (!Array.isArray(parsed.summaries)) throw new Error('The suggestions could not be read. Please try again.');
      setSuggestions(candidates.map(c => ({ id: existing.find(p => p.status === 'confirmed' && p.activity === c.activity && p.startMinute! <= c.endMinute && p.endMinute! >= c.startMinute)?.id ?? `ai-${c.key}`, title: c.title, detail: String(parsed.summaries.find((s: { key: string }) => s.key === c.key)?.detail || `${c.activity} was recorded on ${c.days} days. Review the suggested window before confirming.`).slice(0, 400), evidence: c.evidence, confirmedBy: ownerName, updatedAt: new Date().toISOString(), status: 'confirmed', activity: c.activity, startMinute: c.startMinute, endMinute: c.endMinute, sourceIds: c.sourceIds, generatedBy: 'AI' })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'AI suggestions are unavailable. Your confirmed patterns are unchanged.'); }
    finally { clearTimeout(timeout); setBusy(false); }
  }
  function update(id: string, patch: Partial<DailyPattern>) { setSuggestions(suggestions.map(s => s.id === id ? { ...s, ...patch } : s)); }
  const minute = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
  return <section className="pattern-suggestions"><h2>AI pattern suggestions</h2><p>Use up to 100 public records from the last 7 complete days. An activity must appear on at least 3 days. OpenAI receives bounded timing statistics; no historical media. Suggestions only become daily reminders after a person reviews and confirms them.</p>
    {!candidates.length && <p role="status">Not enough repeated activity yet. Add named breakfast, walk, rest or play records over several days. You can still add a pattern manually.</p>}
    <button className="primary-button" disabled={!enabled || busy || !candidates.length} onClick={() => void generate()}>{busy ? 'Summarizing records…' : 'Suggest from recent records'}</button>
    {!enabled && <p>Sign in as the Primary caregiver to review and confirm suggestions.</p>}
    {error && <p role="alert">{error}</p>}
    {suggestions.map(s => <article key={s.id}><small>AI DRAFT · NOT ACTIVE UNTIL CONFIRMED</small><label>Pattern name<input value={s.title} onChange={e => update(s.id, { title: e.target.value })} /></label><label>Description<textarea value={s.detail} onChange={e => update(s.id, { detail: e.target.value })} /></label><div className="pattern-time-fields"><label>Window starts<input type="time" value={clockMinute(s.startMinute!)} onChange={e => update(s.id, { startMinute: minute(e.target.value) })} /></label><label>Window ends<input type="time" value={clockMinute(s.endMinute!)} onChange={e => update(s.id, { endMinute: minute(e.target.value) })} /></label></div><p>{s.evidence}</p><details><summary>Supporting record dates</summary><ul>{s.sourceIds?.slice(0, 12).map(id => { const r = records.find(r => r.id === id); return r ? <li key={id}>{r.title} · {new Date(r.savedAt).toLocaleString('en-GB')}</li> : null; })}</ul></details><button className="primary-button" disabled={!s.title.trim() || !s.detail.trim() || !Number.isFinite(s.startMinute) || !Number.isFinite(s.endMinute) || s.startMinute! >= s.endMinute!} onClick={() => { const message = onSave({ ...s, updatedAt: new Date().toISOString() }); if (message) setError(message); else { setError(''); setSuggestions(suggestions.filter(p => p.id !== s.id)); } }}>{existing.some(p => p.id === s.id) ? 'Update confirmed pattern' : 'Confirm pattern'}</button><button className="profile-link" onClick={() => setSuggestions(suggestions.filter(p => p.id !== s.id))}>Dismiss draft</button></article>)}
  </section>;
}
