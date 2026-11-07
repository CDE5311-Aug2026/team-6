import { useState } from 'react';
import { compareCareTimes, canToggleCareTaskCompletion, type CareTask } from './careTasks';

type Observation = { id: string; title: string; savedAt: string; linkedCareTaskId?: string; authorName?: string };
type Member = { id: string; name: string };
/** Saving a record is never evidence that a person completed a separate task. */
export default function SavedCareReview({ observation, tasks, members, currentUserId, isPrimary, onConfirm, onOpenPlan }: {
  observation: Observation; tasks: CareTask[]; members: Member[]; currentUserId: string; isPrimary: boolean;
  onConfirm: (task: CareTask) => boolean; onOpenPlan?: () => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const name = (id: string) => members.find(member => member.id === id)?.name ?? 'Caregiver';
  const linked = tasks.find(task => task.id === observation.linkedCareTaskId);
  const candidates = tasks.filter(task => !['done', 'skipped'].includes(task.status)
    && new Date(task.dueAt).toDateString() === new Date(observation.savedAt).toDateString()
    && new Date(task.dueAt).toDateString() === new Date().toDateString()
    && canToggleCareTaskCompletion(task, currentUserId, isPrimary))
    .sort((a, b) => compareCareTimes(a.dueAt, b.dueAt));
  const selected = candidates.find(task => task.id === selectedId);
  return <section className="saved-care-review" aria-label="Record and task status">
    <h2>{linked?.status === 'done' ? 'Record linked · task completed' : 'Record saved · task completion separate'}</h2>
    {linked ? <><p><strong>{linked.title}</strong></p><p>Assigned to {name(linked.assignedTo)} · {linked.status === 'done' ? `Completed by ${linked.completedByName ?? name(linked.completedBy ?? '')}` : 'Completion not confirmed'}</p></>
      : <><p>Recorded by {observation.authorName ?? 'you'}. Saving this record has not completed or reassigned a task.</p>
        {candidates.length > 0 && <><label>Link an existing task (optional)<select value={selectedId} onChange={event => { setSelectedId(event.target.value); setConfirmed(false); setError(''); }}><option value="">Choose a task to review</option>{candidates.map(task => <option key={task.id} value={task.id}>{task.title} · {name(task.assignedTo)}</option>)}</select></label>
          {selected && <><p>Assigned to {name(selected.assignedTo)} · {selected.status}. Confirm only if this record describes the same care action.</p><label className="care-completion-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I personally completed this task. Record me as the performer.</label><button type="button" className="primary-button" disabled={!confirmed} onClick={() => { if (!onConfirm(selected)) setError('Could not confirm completion. The record is saved; review the task and try again.'); }}>Link record &amp; confirm completion</button></>}
        </>}
      </>}
    {error && <p role="alert">{error}</p>}
    {onOpenPlan && <button type="button" className="text-link" onClick={onOpenPlan}>Review care plan →</button>}
  </section>;
}
