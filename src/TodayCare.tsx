import { useEffect, useRef, useState } from 'react';
import { canToggleCareTaskCompletion, careTaskTiming, careTaskUnreadCount, careTasksForDate, type CareTask } from './careTasks';
import type { DailyPattern, TimedRecord } from '../supabase/functions/_shared/dailyPatterns';

type Member = { id: string; name: string; role: string; avatar?: string; access?: 'editor' | 'viewer'; expiresAt?: string };
type Props = {
  petName: string; patterns: DailyPattern[]; observations: TimedRecord[]; tasks: CareTask[]; dayOffset: number;
  members: Member[]; currentUserId: string; canAct: boolean; isPrimary: boolean;
  onDone: (task: CareTask) => void; onOpenPlan: () => void; onPatterns: () => void;
  onRequestHelp: (task: CareTask, recipientId: string) => boolean;
};

export default function TodayCare({ petName, patterns, observations, tasks, members, currentUserId, canAct, isPrimary, onDone, onOpenPlan, onPatterns, onRequestHelp, dayOffset }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [reminding, setReminding] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const helperDrag = useRef<{ pointerId: number; startX: number; scrollLeft: number; moved: boolean } | null>(null);
  const helperClickSuppressed = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  const selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const isSelectedToday = dayOffset === 0;
  const sameDay = (value: string) => new Date(value).toDateString() === selectedDate.toDateString();
  const routine = careTasksForDate(patterns, observations, tasks, selectedDate, now, petName);
  const manual = tasks.filter(task => !task.sourcePatternId && !task.sourceObservationId && sameDay(task.dueAt));
  const today = [...routine, ...manual].filter(task => task.status !== 'skipped');
  const pending = today.filter(task => task.status !== 'done').sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const visiblePending = pending.slice(0, 2);
  const hiddenPendingCount = Math.max(0, pending.length - visiblePending.length);
  const completed = today.filter(task => task.status === 'done');
  const helpers = members.filter(member => member.id !== currentUserId && member.access !== 'viewer' && member.role !== 'Viewer' && (!member.expiresAt || Date.parse(member.expiresAt) > +now));
  const requestCandidates = (task: CareTask) => helpers.filter(member => task.status !== 'declined' || member.id !== task.declinedBy);
  const name = (id?: string) => members.find(member => member.id === id)?.name ?? 'a caregiver';
  const unread = careTaskUnreadCount(tasks, currentUserId);
  const incoming = tasks.filter(task => task.status === 'requested' && task.assignedTo === currentUserId).length;
  const reminderCount = tasks.filter(task => task.status !== 'done' && task.status !== 'skipped' && task.events?.some(event => event.type === 'reminded' && event.targetId === currentUserId && !(event.readBy ?? []).includes(currentUserId))).length;
  function openReminder(task: CareTask) {
    const candidates = requestCandidates(task);
    setReminding(task.id);
    setRecipient(candidates.find(member => task.status !== 'declined' && member.id === task.assignedTo)?.id ?? (candidates.length === 1 ? candidates[0].id : ''));
    setMessage('');
  }
  function startHelperDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    helperDrag.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false };
  }
  function moveHelperDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = helperDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) { drag.moved = true; helperClickSuppressed.current = true; event.currentTarget.classList.add('is-dragging'); event.currentTarget.setPointerCapture(event.pointerId); }
    if (drag.moved) event.currentTarget.scrollLeft = drag.scrollLeft - distance;
  }
  function endHelperDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = helperDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) { event.currentTarget.classList.remove('is-dragging'); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); window.setTimeout(() => { helperClickSuppressed.current = false; }, 0); }
    helperDrag.current = null;
  }
  const selectedLabel = isSelectedToday ? 'Today’s care' : dayOffset === -1 ? 'Yesterday’s care' : `Care · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(selectedDate)}`;
  return <section className="today-care-action" aria-labelledby="today-care-title">
    <header className="today-care-header"><div><h2 id="today-care-title">{selectedLabel}</h2><span className="today-care-progress">{completed.length}/{today.length} done</span></div><button className="today-care-plan" onClick={onOpenPlan}>View all{isSelectedToday && unread > 0 && <span>{unread}</span>}<span aria-hidden="true">→</span></button></header>
    {(incoming > 0 || reminderCount > 0) && <button className="today-care-incoming" onClick={onOpenPlan}>{incoming > 0 ? incoming + ' care requests · Respond' : reminderCount + ' care reminders · Check tasks'} →</button>}
    {!today.length && <div className="today-care-empty"><p>{isSelectedToday ? `Add a task or confirm a routine to plan ${petName}’s day.` : `No care activities were planned for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`}</p><button className="primary-button" onClick={onOpenPlan}>{isPrimary && isSelectedToday ? 'Add task' : 'Open care plan'}</button>{isSelectedToday && <button className="today-care-plan" onClick={onPatterns}>Review routine →</button>}</div>}
    {visiblePending.length > 0 && <ol className="today-care-checklist">{visiblePending.map(task => {
      const timing = careTaskTiming(task, now);
      const canComplete = canAct && canToggleCareTaskCompletion(task,currentUserId,isPrimary);
      const canRequestHelp = canAct && requestCandidates(task).length > 0
        && ['open', 'declined'].includes(task.status)
        && (isPrimary || task.status === 'open' && (!task.assignedTo || task.assignedTo === currentUserId));
      const clock = new Date(task.dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const status = task.status === 'declined' ? 'Needs help' : task.status === 'requested' ? 'Awaiting reply' : timing === 'overdue' ? 'Check first' : timing === 'due' ? 'Due now' : timing === 'soon' ? 'Due soon' : 'Upcoming';
      const isExpanded = expanded === task.id;
      return <li key={task.id} className={'today-care-item ' + timing}>
        <div className="today-care-row">
          <button type="button" className="today-care-check" aria-pressed={false} aria-label={'Mark ' + task.title + ' done'} disabled={!canComplete} onClick={() => onDone(task)}><span aria-hidden="true" /></button>
          <button type="button" className="today-care-task" aria-expanded={isExpanded} aria-controls={'care-detail-' + task.id} onClick={() => setExpanded(isExpanded ? null : task.id)}><span className="today-care-task-title">{task.title}</span><span className="today-care-task-meta"><time>{clock}</time><span aria-hidden="true">·</span><span className="today-care-status">{status}</span>{task.assignedTo && <><span aria-hidden="true">·</span><span>{name(task.assignedTo)}</span></>}</span></button>
          {reminding === task.id && !recipient && <div className="care-helper-choices is-inline" role="group" aria-label="Choose a caregiver" onPointerDown={startHelperDrag} onPointerMove={moveHelperDrag} onPointerUp={endHelperDrag} onPointerCancel={endHelperDrag}>{requestCandidates(task).map(member => <button type="button" className="care-helper-choice" key={member.id} aria-label={`Choose ${member.name}`} onClick={event => { if (helperClickSuppressed.current) { event.preventDefault(); helperClickSuppressed.current = false; return; } setRecipient(member.id); }}><span className="care-helper-avatar">{member.avatar ? <img src={member.avatar} alt="" /> : member.name.trim().slice(0,1).toUpperCase()}</span></button>)}</div>}
          {canRequestHelp && <button type="button" className="today-care-remind" aria-label={'Ask a caregiver to take ' + task.title} title="Ask a caregiver" aria-expanded={reminding === task.id} onClick={() => { if (reminding === task.id) setReminding(null); else openReminder(task); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></button>}
        </div>
        <div id={'care-detail-' + task.id} className="today-care-task-detail" hidden={!isExpanded}>
          {task.note && <p>{task.note}</p>}
          <p>{task.status === 'requested' ? 'Waiting for ' + name(task.assignedTo) + ' to accept.' : task.assignedTo ? name(task.assignedTo) + ' is assigned to this task.' : 'No caregiver assigned yet. Check with your care circle before acting.'}</p>
          {(timing === 'due' || timing === 'overdue') && <p>No completion confirmed. Check before repeating care.</p>}
          {task.status === 'requested' && task.assignedTo === currentUserId && <button className="today-care-plan" onClick={onOpenPlan}>Accept or decline →</button>}
          {task.status === 'declined' && isPrimary && <button className="today-care-plan" onClick={onOpenPlan}>Find another caregiver →</button>}
        </div>
        {reminding === task.id && recipient && <form className="care-help-form is-confirming" onSubmit={event => { event.preventDefault(); if (onRequestHelp(task, recipient)) { setMessage('Request sent to ' + name(recipient) + '.'); setReminding(null); setRecipient(''); } }}>
          <div className="care-help-confirm"><span className="care-helper-avatar">{helpers.find(member => member.id === recipient)?.avatar ? <img src={helpers.find(member => member.id === recipient)?.avatar} alt="" /> : name(recipient).trim().slice(0,1).toUpperCase()}</span><p>Ask <strong>{name(recipient)}</strong> to take <strong>{task.title.toLowerCase()}</strong>?</p></div><p>They’ll be able to accept or decline this care request.</p><div className="today-care-actions"><button type="button" className="cancel-button" onClick={() => setRecipient('')}>Back</button><button type="submit" className="primary-button">Send request</button></div>
        </form>}
      </li>;
    })}</ol>}
    {hiddenPendingCount > 0 && <button type="button" className="today-care-more" onClick={onOpenPlan}>+{hiddenPendingCount} more {hiddenPendingCount === 1 ? 'task' : 'tasks'} →</button>}
    {message && <p className="today-care-message" role="status">{message}</p>}
    {today.length > 0 && !pending.length && <p className="today-care-all-done">✓ All planned care is recorded.</p>}
  </section>;
}
