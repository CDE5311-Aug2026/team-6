import { useEffect, useRef, useState } from 'react';
import { canToggleCareTaskCompletion, careTaskTiming, careTaskUnreadCount, careTasksForDate, type CareTask } from './careTasks';
import type { DailyPattern, TimedRecord } from '../supabase/functions/_shared/dailyPatterns';

type Member = { id: string; name: string; role: string; avatar?: string; access?: 'editor' | 'viewer'; expiresAt?: string };
type Props = {
  petName: string; patterns: DailyPattern[]; observations: TimedRecord[]; tasks: CareTask[]; dayOffset: number;
  members: Member[]; currentUserId: string; primaryMemberId: string; canAct: boolean; isPrimary: boolean;
  onDone: (task: CareTask) => void; onOpenPlan: () => void; onOpenRequests?: () => void; onPatterns: () => void;
  onRequestHelp: (task: CareTask, recipientId: string, note?: string) => boolean;
};

export default function TodayCare({ petName, patterns, observations, tasks, members, currentUserId, primaryMemberId, canAct, isPrimary, onDone, onOpenPlan, onOpenRequests, onRequestHelp, dayOffset }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [recentId, setRecentId] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const helperDrag = useRef<{ pointerId: number; startX: number; scrollLeft: number; moved: boolean } | null>(null);
  const helperClickSuppressed = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  const selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const isSelectedToday = dayOffset === 0;
  const sameDay = (value: string) => new Date(value).toDateString() === selectedDate.toDateString();
  const routine = careTasksForDate(patterns, observations, tasks, selectedDate, now, petName, primaryMemberId);
  const manual = tasks.filter(task => !task.sourcePatternId && (!task.sourceObservationId || !!task.demoSlot) && sameDay(task.dueAt));
  const today = [...routine, ...manual].filter(task => task.status !== 'skipped');
  const pending = today.filter(task => task.status !== 'done').sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const visiblePending = pending.slice(0, 2);
  const hiddenPendingCount = Math.max(0, pending.length - visiblePending.length);
  const completed = today.filter(task => task.status === 'done');
  const assignedId = (task: CareTask) => task.assignedTo || primaryMemberId;
  const helpers = members.filter(member => member.access !== 'viewer' && member.role !== 'Viewer' && (!member.expiresAt || Date.parse(member.expiresAt) > +now));
  const requestCandidates = (task: CareTask) => helpers.filter(member => member.id !== assignedId(task) && (member.id === currentUserId || task.status !== 'declined' || member.id !== task.declinedBy));
  const name = (id?: string) => members.find(member => member.id === id)?.name ?? 'a caregiver';
  const renderCareNote = (note: string) => {
    const amount = /\b\d+(?:\.\d+)?\s?(?:g|kg|ml|oz|lb|minutes?|mins?|hours?|hrs?)\b/i.exec(note);
    if (!amount || amount.index === undefined) return note;
    return <>{note.slice(0, amount.index)}<strong className="today-care-emphasis">{amount[0]}</strong>{note.slice(amount.index + amount[0].length)}</>;
  };
  const unread = careTaskUnreadCount(tasks, currentUserId);
  const incoming = tasks.filter(task => task.status === 'requested' && task.assignedTo === currentUserId).length;
  const reminderCount = tasks.filter(task => task.status !== 'done' && task.status !== 'skipped' && task.events?.some(event => event.type === 'reminded' && event.targetId === currentUserId && !(event.readBy ?? []).includes(currentUserId))).length;
  function openReminder(task: CareTask) {
    setReminding(task.id);
    setRecipient('');
    setMessage('');
    setRequestNote('');
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
    {(incoming > 0 || reminderCount > 0) && <button className="today-care-incoming" onClick={onOpenRequests ?? onOpenPlan}>{incoming > 0 ? incoming + ' care requests · Respond' : reminderCount + ' care reminders · Check tasks'} →</button>}
    {!today.length && <div className="today-care-empty"><p>{isSelectedToday ? 'Not enough recorded activity yet to generate care tasks automatically.' : `No care activities were planned for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`}</p></div>}
    {visiblePending.length > 0 && <ol className="today-care-checklist">{visiblePending.map(task => {
      const timing = careTaskTiming(task, now);
      const canComplete = canAct && canToggleCareTaskCompletion(task,currentUserId,isPrimary);
      const canRequestHelp = canAct && requestCandidates(task).length > 0 && ['open', 'requested', 'accepted', 'declined'].includes(task.status);
      const clock = new Date(task.dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const status = task.status === 'declined' ? 'Needs help' : task.status === 'requested' ? 'Awaiting reply' : timing === 'overdue' ? 'Check first' : timing === 'due' ? 'Due now' : timing === 'soon' ? 'Due soon' : 'Upcoming';
      const isExpanded = expanded === task.id;
      return <li key={task.id} className={'today-care-item ' + timing}>
        <div className="today-care-row">
          <button type="button" className="today-care-check" aria-pressed={false} aria-label={'Mark ' + task.title + ' done'} disabled={!canComplete} onClick={() => { setRecentId(task.id); onDone(task); }}><span aria-hidden="true" /></button>
          <button type="button" className="today-care-task" aria-expanded={isExpanded} aria-controls={'care-detail-' + task.id} onClick={() => setExpanded(isExpanded ? null : task.id)}><span className="today-care-task-title">{task.title}</span><span className="today-care-task-meta"><time>{clock}</time><span aria-hidden="true">·</span><span className="today-care-status">{status}</span><span aria-hidden="true">·</span><span>{name(assignedId(task))}</span></span></button>
          {reminding === task.id && !recipient && <div className="care-helper-choices is-inline" role="group" aria-label="Choose a caregiver" onPointerDown={startHelperDrag} onPointerMove={moveHelperDrag} onPointerUp={endHelperDrag} onPointerCancel={endHelperDrag}>{requestCandidates(task).map(member => <button type="button" className="care-helper-choice" key={member.id} aria-label={`Choose ${member.name}`} onClick={event => { if (helperClickSuppressed.current) { event.preventDefault(); helperClickSuppressed.current = false; return; } setRecipient(member.id); }}><span className={'care-helper-avatar ' + (['away','busy'].includes((() => { try { return localStorage.getItem('pawsona-availability:' + member.name) || ''; } catch { return ''; } })()) ? 'is-unavailable' : '')}>{member.avatar ? <img src={member.avatar} alt="" /> : member.name.trim().slice(0,1).toUpperCase()}</span></button>)}</div>}
          {canAct && (canRequestHelp || Boolean(assignedId(task))) && <button type="button" className="today-care-remind" disabled={!canRequestHelp} aria-label={'Change who is doing ' + task.title} title="Change caregiver" aria-expanded={reminding === task.id} onClick={() => { if (reminding === task.id) setReminding(null); else openReminder(task); }}><span className={'care-helper-avatar ' + (['away','busy'].includes((() => { try { const member = members.find(m => m.id === assignedId(task)); return localStorage.getItem('pawsona-availability:' + (member?.name || '')) || ''; } catch { return ''; } })()) ? 'is-unavailable' : '')}>{members.find(member => member.id === assignedId(task))?.avatar ? <img src={members.find(member => member.id === assignedId(task))?.avatar} alt="" /> : assignedId(task) ? name(assignedId(task)).trim().slice(0, 1).toUpperCase() : '?'}</span><span className="care-assignee-switch" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" /></svg></span></button>}
        </div>
        <div id={'care-detail-' + task.id} className="today-care-task-detail" hidden={!isExpanded}>
          {task.note && <p>{renderCareNote(task.note)}</p>}
          <p>{task.status === 'requested' ? 'Waiting for ' + name(task.assignedTo) + ' to accept.' : assignedId(task) ? name(assignedId(task)) + ' is assigned to this task.' : 'No caregiver assigned yet. Check with your care circle before acting.'}</p>
          {(timing === 'due' || timing === 'overdue') && <p>No completion confirmed. Check before repeating care.</p>}
          {task.status === 'requested' && task.assignedTo === currentUserId && <button className="today-care-plan" onClick={onOpenRequests ?? onOpenPlan}>Accept or decline →</button>}
          {task.status === 'declined' && isPrimary && <button className="today-care-plan" onClick={onOpenRequests ?? onOpenPlan}>Find another caregiver →</button>}
        </div>
        {reminding === task.id && recipient && <form className="care-help-form is-confirming" onSubmit={event => { event.preventDefault(); if (onRequestHelp(task, recipient, requestNote.trim())) { setMessage(recipient === currentUserId ? 'You’re taking this task.' : 'Request sent to ' + name(recipient) + '.'); setReminding(null); setRecipient(''); setRequestNote(''); } }}>
          <div className="care-help-confirm"><span className="care-helper-avatar">{helpers.find(member => member.id === recipient)?.avatar ? <img src={helpers.find(member => member.id === recipient)?.avatar} alt="" /> : name(recipient).trim().slice(0,1).toUpperCase()}</span><p>{recipient === currentUserId ? <>Take <strong>{task.title.toLowerCase()}</strong> yourself?</> : <>Ask <strong>{name(recipient)}</strong> to take <strong>{task.title.toLowerCase()}</strong>?</>}</p></div><label className="care-request-message"><span>Message (optional)</span><textarea aria-label="Care request message (optional)" placeholder="Leave a massage" maxLength={240} rows={3} value={requestNote} onChange={event => setRequestNote(event.target.value)} /></label><div className="today-care-actions"><button type="button" className="cancel-button" onClick={() => setRecipient('')}>Back</button><button type="submit" className="primary-button">{recipient === currentUserId ? 'I’ll take it' : 'Send request'}</button></div>
        </form>}
      </li>;
    })}</ol>}
    {hiddenPendingCount > 0 && <button type="button" className="today-care-more" onClick={onOpenPlan}>+{hiddenPendingCount} more {hiddenPendingCount === 1 ? 'task' : 'tasks'} →</button>}
    {recentId && completed.find(task => task.id === recentId) && (() => { const task = completed.find(entry => entry.id === recentId)!; return <div className="today-care-recent" role="status"><span><strong>✓ Done · {task.title}</strong><small>Completed by {task.completedByName ?? name(task.completedBy)}</small></span><button type="button" onClick={() => { onDone(task); setRecentId(null); }}>Undo</button></div>; })()}
    {message && <p className="today-care-message" role="status">{message}</p>}
    {today.length > 0 && !pending.length && <p className="today-care-all-done">✓ All planned care is recorded.</p>}
  </section>;
}
