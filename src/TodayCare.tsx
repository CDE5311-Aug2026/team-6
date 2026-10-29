import { useEffect, useState } from 'react';
import { careTaskTiming, careTaskUnreadCount, careTasksForDate, canRemindCareTask, type CareTask } from './careTasks';
import type { DailyPattern, TimedRecord } from '../supabase/functions/_shared/dailyPatterns';

type Member = { id: string; name: string; role: string; access?: 'editor' | 'viewer'; expiresAt?: string };
type Props = {
  petName: string; patterns: DailyPattern[]; observations: TimedRecord[]; tasks: CareTask[];
  members: Member[]; currentUserId: string; canAct: boolean; isPrimary: boolean;
  onDone: (task: CareTask) => void; onOpenPlan: () => void; onPatterns: () => void;
  onRemind: (task: CareTask, recipientId: string) => boolean;
};

export default function TodayCare({ petName, patterns, observations, tasks, members, currentUserId, canAct, isPrimary, onDone, onOpenPlan, onPatterns, onRemind }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [reminding, setReminding] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  const sameDay = (value: string) => new Date(value).toDateString() === now.toDateString();
  const routine = careTasksForDate(patterns, observations, tasks, now, now, petName);
  const manual = tasks.filter(task => !task.sourcePatternId && !task.sourceObservationId && sameDay(task.dueAt));
  const today = [...routine, ...manual].filter(task => task.status !== 'skipped');
  const pending = today.filter(task => task.status !== 'done').sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const completed = today.filter(task => task.status === 'done');
  const helpers = members.filter(member => member.id !== currentUserId && member.access !== 'viewer' && member.role !== 'Viewer' && (!member.expiresAt || Date.parse(member.expiresAt) > +now));
  const name = (id?: string) => members.find(member => member.id === id)?.name ?? 'a caregiver';
  const unread = careTaskUnreadCount(tasks, currentUserId);
  const incoming = tasks.filter(task => task.status === 'requested' && task.assignedTo === currentUserId).length;
  const reminderCount = tasks.filter(task => task.status !== 'done' && task.status !== 'skipped' && task.events?.some(event => event.type === 'reminded' && event.targetId === currentUserId && !(event.readBy ?? []).includes(currentUserId))).length;
  function openReminder(task: CareTask) {
    setReminding(task.id);
    setRecipient(helpers.find(member => member.id === task.assignedTo)?.id ?? (helpers.length === 1 ? helpers[0].id : ''));
    setMessage('');
  }
  const lastDone = completed.filter(task => !task.autoCompleted).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];
  return <section className="today-care-action" aria-labelledby="today-care-title">
    <header className="today-care-header"><div><h2 id="today-care-title">Today’s care</h2><span className="today-care-progress">{completed.length}/{today.length} done</span></div><button className="today-care-plan" onClick={onOpenPlan}>Requests{unread > 0 && <span>{unread}</span>}<span aria-hidden="true">↗</span></button></header>
    {(incoming > 0 || reminderCount > 0) && <button className="today-care-incoming" onClick={onOpenPlan}>{incoming > 0 ? incoming + ' care requests · Respond' : reminderCount + ' care reminders · Check tasks'} →</button>}
    {!today.length && <div className="today-care-empty"><p>Add a task or confirm a routine to plan {petName}’s day.</p><button className="primary-button" onClick={onOpenPlan}>{isPrimary ? 'Add task' : 'Open care plan'}</button><button className="today-care-plan" onClick={onPatterns}>Review routine →</button></div>}
    {pending.length > 0 && <ol className="today-care-checklist">{pending.map(task => {
      const timing = careTaskTiming(task, now);
      const canComplete = canAct && ['open', 'accepted'].includes(task.status) && (!task.assignedTo || task.assignedTo === currentUserId || isPrimary);
      const canRemind = canAct && helpers.length > 0 && (isPrimary || !task.assignedTo || task.assignedTo === currentUserId);
      const clock = new Date(task.dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const status = task.status === 'declined' ? 'Needs help' : task.status === 'requested' ? 'Awaiting reply' : timing === 'overdue' ? 'Check first' : timing === 'due' ? 'Due now' : timing === 'soon' ? 'Due soon' : 'Upcoming';
      const isExpanded = expanded === task.id;
      return <li key={task.id} className={'today-care-item ' + timing}>
        <div className="today-care-row">
          <button type="button" className="today-care-check" aria-label={'Mark ' + task.title + ' done'} disabled={!canComplete} onClick={() => onDone(task)}><span aria-hidden="true" /></button>
          <button type="button" className="today-care-task" aria-expanded={isExpanded} aria-controls={'care-detail-' + task.id} onClick={() => setExpanded(isExpanded ? null : task.id)}><span className="today-care-task-title">{task.title}</span><span className="today-care-task-meta"><time>{clock}</time><span aria-hidden="true">·</span><span className="today-care-status">{status}</span>{task.assignedTo && <><span aria-hidden="true">·</span><span>{name(task.assignedTo)}</span></>}</span></button>
          {canRemind && <button type="button" className="today-care-remind" aria-label={'Remind a caregiver about ' + task.title} title="Remind caregiver" aria-expanded={reminding === task.id} onClick={() => { if (reminding === task.id) setReminding(null); else openReminder(task); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></button>}
        </div>
        <div id={'care-detail-' + task.id} className="today-care-task-detail" hidden={!isExpanded}>
          {task.note && <p>{task.note}</p>}
          <p>{task.status === 'requested' ? 'Waiting for ' + name(task.assignedTo) + ' to accept.' : task.assignedTo ? name(task.assignedTo) + ' is assigned to this task.' : 'No caregiver assigned yet. Check with your care circle before acting.'}</p>
          {(timing === 'due' || timing === 'overdue') && <p>No completion confirmed. Check before repeating care.</p>}
          {task.status === 'requested' && task.assignedTo === currentUserId && <button className="today-care-plan" onClick={onOpenPlan}>Accept or decline →</button>}
          {task.status === 'declined' && isPrimary && <button className="today-care-plan" onClick={onOpenPlan}>Find another caregiver →</button>}
        </div>
        {reminding === task.id && <form className="care-help-form" onSubmit={event => { event.preventDefault(); if (recipient && canRemindCareTask(task, recipient, now) && onRemind(task, recipient)) { setMessage('Reminder added for ' + name(recipient) + '. Check sync status to confirm it saved.'); setReminding(null); } }}><label>Remind caregiver<select autoFocus value={recipient} onChange={event => setRecipient(event.target.value)} required><option value="">Choose a caregiver</option>{helpers.map(member => <option key={member.id} value={member.id}>{member.name}{member.role === 'Temporary caregiver' ? ' · Temporary caregiver' : ''}</option>)}</select></label><p>Please check {task.title.toLowerCase()}. If it is already done, record who completed it.</p><div className="today-care-actions"><button type="button" className="cancel-button" onClick={() => setReminding(null)}>Cancel</button><button type="submit" className="primary-button" disabled={!recipient || !canRemindCareTask(task, recipient, now)}>Send reminder</button></div>{recipient && !canRemindCareTask(task, recipient, now) && <small>A reminder was sent recently. Try again after 5 minutes.</small>}</form>}
      </li>;
    })}</ol>}
    {message && <p className="today-care-message" role="status">{message}</p>}
    {today.length > 0 && !pending.length && <p className="today-care-all-done">✓ All planned care is recorded.</p>}
    {lastDone && <div className="today-care-last-done"><span aria-hidden="true">✓</span><p><strong>{lastDone.title}</strong><small>Done by {lastDone.completedByName ?? name(lastDone.completedBy)}{lastDone.completedAt ? ' · ' + new Date(lastDone.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</small></p></div>}
    {completed.length > 0 && <details className="today-care-completed"><summary><span>Completed <span className="today-care-completed-count">{completed.length}</span></span><span className="today-care-chevron" aria-hidden="true">⌄</span></summary>{completed.map(task => <div className="today-care-done-row" key={task.id}><span aria-hidden="true">✓</span><p><strong>{task.title}</strong><small>{task.autoCompleted ? 'Simulation · caregiver not verified' : 'Done by ' + (task.completedByName ?? name(task.completedBy))}{task.completedAt ? ' · ' + new Date(task.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</small></p></div>)}</details>}
    <footer><span><span className="today-care-bell-dot" aria-hidden="true" />In-app reminders</span><button className="today-care-plan" onClick={onOpenPlan}>View all →</button></footer>
  </section>;
}
