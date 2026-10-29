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
  return <section className="today-care-action" aria-labelledby="today-care-title">
    <header><div><p className="eyebrow">WHAT TO DO NEXT</p><h2 id="today-care-title">Today’s care</h2></div><button className="profile-link" onClick={onOpenPlan}>Plan &amp; requests{unread > 0 ? ` (${unread})` : ''} →</button></header>
    <p>{today.length ? `${completed.length} of ${today.length} done · ${pending.length} still to do` : `Plan the next care action for ${petName}.`}</p>
    {(incoming > 0 || reminderCount > 0) && <button className="today-care-incoming" onClick={onOpenPlan}>{incoming > 0 ? `${incoming} care request${incoming === 1 ? '' : 's'} · Accept or decline` : `${reminderCount} care reminder${reminderCount === 1 ? '' : 's'} · Check the task`} →</button>}
    {!today.length && <div className="today-care-empty"><p>Add a task with a time, or confirm a routine to build this checklist.</p><button className="primary-button" onClick={onOpenPlan}>{isPrimary ? 'Add a care task' : 'Open care plan'}</button><button className="profile-link" onClick={onPatterns}>Review routine times →</button></div>}
    {pending.length > 0 && <ol className="today-care-checklist">{pending.map(task => {
      const timing = careTaskTiming(task, now);
      const canComplete = canAct && ['open', 'accepted'].includes(task.status) && (!task.assignedTo || task.assignedTo === currentUserId || isPrimary);
      const canRemind = canAct && helpers.length > 0 && (isPrimary || !task.assignedTo || task.assignedTo === currentUserId);
      const clock = new Date(task.dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return <li key={task.id} className={`today-care-item ${timing}`}><div className="today-care-item-top"><time>{clock}</time><span>{task.status === 'declined' ? 'Needs another caregiver' : timing === 'overdue' ? 'Past planned time · check first' : timing === 'due' ? 'Time to check' : timing === 'soon' ? 'Due within 15 min' : 'Upcoming'}</span></div><h3>{task.title}</h3>
        <p>{task.status === 'requested' ? `Waiting for ${name(task.assignedTo)} to accept` : task.status === 'accepted' ? `${name(task.assignedTo)} is handling this` : task.assignedTo ? `Assigned to ${name(task.assignedTo)}` : 'No caregiver assigned yet'}</p>
        {task.sourcePatternId && <small>{task.note}</small>}
        {(timing === 'due' || timing === 'overdue') && <small>No completion confirmed. Check with a caregiver before repeating care.</small>}
        <div className="today-care-actions">{canComplete && <button className="primary-button" onClick={() => onDone(task)}>Mark done</button>}{canRemind && <button className="cancel-button" onClick={() => openReminder(task)}>Remind caregiver</button>}{task.status === 'requested' && task.assignedTo === currentUserId && <button className="primary-button" onClick={onOpenPlan}>Respond to request</button>}{task.status === 'declined' && isPrimary && <button className="profile-link" onClick={onOpenPlan}>Find another caregiver →</button>}</div>
        {reminding === task.id && <form className="care-help-form" onSubmit={event => { event.preventDefault(); if (recipient && canRemindCareTask(task, recipient, now) && onRemind(task, recipient)) { setMessage(`Reminder added for ${name(recipient)}. Check sync status to confirm it saved.`); setReminding(null); } }}><label>Who should check this task?<select autoFocus value={recipient} onChange={event => setRecipient(event.target.value)} required><option value="">Choose a caregiver</option>{helpers.map(member => <option key={member.id} value={member.id}>{member.name}{member.role === 'Temporary caregiver' ? ' · Temporary caregiver' : ''}</option>)}</select></label><p>“Please check {task.title.toLowerCase()}. If it is already done, record who completed it.”</p><small>In-app reminder. The caregiver needs to open Pawsona.</small><div className="today-care-actions"><button type="button" className="cancel-button" onClick={() => setReminding(null)}>Cancel</button><button type="submit" className="primary-button" disabled={!recipient || !canRemindCareTask(task, recipient, now)}>Send reminder</button></div>{recipient && !canRemindCareTask(task, recipient, now) && <small>A reminder was sent recently. Try again after 5 minutes.</small>}</form>}
      </li>;
    })}</ol>}
    {message && <p role="status">{message}</p>}
    {today.length > 0 && !pending.length && <p className="today-care-all-done">✓ All planned care is recorded for today.</p>}
    {completed.length > 0 && <details className="today-care-completed" open><summary>Completed ({completed.length})</summary>{completed.map(task => <p key={task.id}><strong>{task.title}</strong><span>{task.autoCompleted ? 'Simulated activity recorded · caregiver not verified' : `Done by ${task.completedByName ?? name(task.completedBy)}`}{task.completedAt ? ` · ${new Date(task.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</span></p>)}</details>}
    <small className="today-care-delivery">Time prompts update while Pawsona is open. Phone and lock-screen notifications are not connected.</small>
  </section>;
}
