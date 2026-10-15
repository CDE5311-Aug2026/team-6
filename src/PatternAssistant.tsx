import { useEffect, useRef, useState } from 'react';
import { supabase } from './cloud';
import { patternWindow, patternFingerprint, type PatternRecord, type PatternAnalysis, type SuggestedPattern } from '../supabase/functions/patterns-ai/core';
export type { PatternAnalysis };
type Result = { fingerprint: string; patterns: SuggestedPattern[] | null };
// Share in-flight work across navigation/StrictMode without repeating paid requests.
const requests = new Map<string, Promise<Result>>();
async function analyze(key: string, petId: string, fingerprint: string) {
  if (!requests.has(key)) requests.set(key, (async () => {
    if (!supabase) throw new Error('Log in to enable automatic pattern suggestions. You can add a pattern manually.');
    const { data, error } = await supabase.functions.invoke('patterns-ai', { body: { petId, fingerprint } });
    if (error) {
      if (error.context instanceof Response) {
        const body = await error.context.json().catch(() => null);
        if (body?.error) throw new Error(body.error);
      }
      throw new Error('Could not connect to AI. Retry later or add a pattern manually.');
    }
    if (data?.fingerprint !== fingerprint || !(data.patterns === null || Array.isArray(data.patterns))) throw new Error('Invalid analysis response. Please retry.');
    return data as Result;
  })());
  return requests.get(key)!;
}
export default function PatternAssistant({ identity, petId, records, analysis, enabled, synced, onResult, onManual }: {
  identity: string; petId: string; records: PatternRecord[]; analysis?: PatternAnalysis; enabled: boolean; synced: boolean;
  onResult: (result: Result) => string; onManual: () => void;
}) {
  const window = patternWindow(records);
  const signature = JSON.stringify(window.records);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const latest = useRef({ onResult, signature }); latest.current = { onResult, signature };
  useEffect(() => {
    if (!enabled || !synced || !window.eligible) return;
    let disposed = false;
    const timer = setTimeout(() => { void (async () => {
      const fingerprint = await patternFingerprint(JSON.parse(signature));
      if (disposed || analysis?.fingerprint === fingerprint) return;
      setBusy(true); setError('');
      const key = identity + ':' + fingerprint;
      if (retry) requests.delete(key);
      try {
        const result = await analyze(key, petId, fingerprint);
        if (!disposed && latest.current.signature === signature) {
          const saveError = latest.current.onResult(result);
          if (saveError) setError(saveError);
        }
      } catch (cause) { if (!disposed) setError(cause instanceof Error ? cause.message : 'Analysis failed. Please retry.'); }
      finally { if (!disposed) setBusy(false); }
    })(); }, 900);
    return () => { disposed = true; clearTimeout(timer); };
  }, [identity, petId, signature, enabled, synced, analysis?.fingerprint, retry, window.eligible]);
  return <section className="pattern-assistant" aria-label="AI pattern suggestions">
    <strong>{window.eligible ? 'Suggested patterns' : 'More data needed'}</strong>
    <p>{!window.eligible ? `AI needs records on at least 7 consecutive days. Current streak: ${window.streak}/7 days. You can add a pattern manually now.` : busy ? 'Looking for recurring patterns in the latest 7 days…' : !enabled ? 'Log in as the Primary caregiver to enable automatic suggestions.' : !synced ? 'Waiting for your records to sync…' : analysis ? `${analysis.count} suggestions from the last analysis. New records are checked automatically when you open this page.` : 'Your records are ready. AI will suggest patterns for you to review.'}</p>
    {window.dates.length > 0 && <small>{window.dates[0]} – {window.dates.at(-1)} · Singapore time · A day needs at least one shared, dated observation.</small>}
    {error && <p role="alert">{error}</p>}
    <div className="source-detail-actions">{enabled && <button className="cancel-button" onClick={onManual}>Add manually</button>}{error && enabled && <button className="primary-button" disabled={busy || !synced} onClick={() => setRetry(n => n+1)}>Retry analysis</button>}</div>
    {window.eligible && <small>Suggestions need your review. Confirmed patterns and your edits are kept.</small>}
  </section>;
}
