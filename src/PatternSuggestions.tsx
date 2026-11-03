import { useEffect, useRef, useState } from 'react';
import { requestAskAI } from './askAI';
import { patternCandidates, type DailyPattern, type TimedRecord } from '../supabase/functions/_shared/dailyPatterns';

const REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000;

export default function PatternSuggestions({ petId, records, ownerName, existing, onSaveMany, enabled }: {
  petId: string;
  records: TimedRecord[];
  ownerName: string;
  existing: DailyPattern[];
  onSaveMany: (patterns: DailyPattern[]) => string;
  enabled: boolean;
}) {
  const requestInFlight = useRef(false);
  const latest = useRef({ existing, onSaveMany, ownerName });
  const [message, setMessage] = useState('');
  latest.current = { existing, onSaveMany, ownerName };

  const candidates = patternCandidates(records);
  const candidateKey = candidates.map(({ key }) => key).join('|');

  useEffect(() => {
    if (!enabled || !candidates.length || requestInFlight.current) return;
    const storageKey = `pawsona:pattern-refresh:${petId}`;
    const lastRefresh = Number(localStorage.getItem(storageKey) || 0);
    if (Date.now() - lastRefresh < REFRESH_INTERVAL) return;

    requestInFlight.current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    setMessage('Updating patterns…');

    void (async () => {
      try {
        const stats = candidates.map(({ key, activity, count, days, startMinute, endMinute }) => ({ key, activity, count, days, startMinute, endMinute }));
        const answer = await requestAskAI(petId, [{ role: 'user', text: `Summarize these bounded recorded-time groups as concise descriptions of typical pet activity patterns, in English. Do not infer health, emotions, duration or missing care. Return ONLY JSON: {"summaries":[{"key":"group key","detail":"one short sentence based on the counts and time window"}]}. Statistics: ${JSON.stringify(stats)}` }], controller.signal, false);
        const parsed = JSON.parse(answer.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
        if (!Array.isArray(parsed.summaries)) throw new Error('The automatic pattern update could not be read.');

        const { existing: current, onSaveMany: saveMany, ownerName: owner } = latest.current;
        const nextPatterns: DailyPattern[] = [];
        const updatedIds = new Set<string>();
        for (const candidate of candidates) {
          const matched = current.find(pattern => pattern.generatedBy === 'AI' && pattern.status === 'confirmed' && pattern.activity === candidate.activity && pattern.startMinute! <= candidate.endMinute && pattern.endMinute! >= candidate.startMinute);
          const id = matched?.id ?? `ai-${candidate.key}`;
          const detail = String(parsed.summaries.find((summary: { key?: string }) => summary?.key === candidate.key)?.detail || `${candidate.activity} was recorded on ${candidate.days} days.`).slice(0, 400);
          nextPatterns.push({
            id,
            title: candidate.title,
            detail,
            evidence: candidate.evidence,
            confirmedBy: owner,
            updatedAt: new Date().toISOString(),
            status: 'confirmed',
            activity: candidate.activity,
            startMinute: candidate.startMinute,
            endMinute: candidate.endMinute,
            sourceIds: candidate.sourceIds,
            generatedBy: 'AI',
          });
          updatedIds.add(id);
        }

        // Keep stale AI patterns in the archive so the owner can still inspect them.
        for (const pattern of current) {
          if (pattern.generatedBy === 'AI' && pattern.status === 'confirmed' && !updatedIds.has(pattern.id)) {
            nextPatterns.push({ ...pattern, status: 'archived', updatedAt: new Date().toISOString() });
          }
        }
        const error = saveMany(nextPatterns);
        if (error) throw new Error(error);
        localStorage.setItem(storageKey, String(Date.now()));
        setMessage('Patterns updated automatically.');
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : 'Automatic pattern updates are temporarily unavailable.');
      } finally {
        window.clearTimeout(timeout);
        requestInFlight.current = false;
      }
    })();
  // candidateKey intentionally represents the data inputs; latest keeps callbacks and saved patterns current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, petId, candidateKey]);

  if (!message) return null;
  return <p className={`pattern-refresh-status${message.includes('unavailable') || message.includes('could not') ? ' is-error' : ''}`} role="status">{message}</p>;
}
