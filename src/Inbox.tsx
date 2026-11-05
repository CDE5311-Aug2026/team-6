import { useEffect, useRef, useState } from 'react';
import type { CareTask } from './careTasks';
import { taskAdvice, type InboxCategory, type InboxMessage } from './inboxModel';

export function InboxIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="m4 6 8 7 8-7"/></svg>;
}
export function InboxButton({ count, onClick }: { count: number; onClick: () => void }) {
  return <button type="button" className="inbox-icon-button" aria-label={`Open Inbox${count ? `, ${count} unread messages` : ''}`} onClick={onClick}><InboxIcon />{count > 0 && <span className="inbox-unread-dot" />}</button>;
}
const labels = { care: 'Shared care', social: 'Interactions', pet: 'Pet updates' };
function dateLabel(stamp: string) {
  const day = new Date(stamp);
  const today = new Date();
  if (day.toDateString() === today.toDateString()) return 'Today';
  today.setDate(today.getDate() - 1);
  return day.toDateString() === today.toDateString() ? 'Yesterday' : day.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}
export default function Inbox({ messages, onBack, onRead, onReadAll, onOpenMoment, onOpenPlan, onRespond, canRespond, onAskAI, onOpenInvitations }: {
  messages: InboxMessage[]; onBack: () => void; onRead: (id: string) => void; onReadAll: () => void;
  onOpenMoment: (petId: string, momentId: string) => void; onOpenPlan: (petId: string) => void;
  onRespond: (petId: string, task: CareTask, accept: boolean) => boolean;
  canRespond: (petId: string) => boolean;
  onAskAI: (petId: string, task: CareTask) => void;
  onOpenInvitations: () => void;
}) {
  const [category, setCategory] = useState<'all' | InboxCategory>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => { pageRef.current?.scrollIntoView({ block: 'start' }); }, [selectedId]);
  const selected = messages.find(m => m.id === selectedId);
  const unread = messages.filter(m => !m.read).length;
  const filtered = messages.filter(m => (category === 'all' || m.category === category) && (!unreadOnly || !m.read));
  if (selected) {
    const task = selected.task;
    const advice = task ? taskAdvice(task) : null;
    return <section ref={pageRef} className="inbox-page inbox-detail">
      <header className="inbox-heading"><button className="back-button" aria-label="Back to Inbox" onClick={() => setSelectedId(null)}>←</button><h1>Message</h1><span className="inbox-category-label">{labels[selected.category]}</span></header>
      {selected.demo && <p className="inbox-example-label">Message example · For trying Inbox</p>}
      <div className="inbox-detail-person"><span className="inbox-avatar">{selected.actorAvatar ? <img src={selected.actorAvatar} alt="" /> : selected.actorName.slice(0, 1)}</span><div><strong>{selected.actorName}</strong><small>{new Date(selected.createdAt).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</small></div></div>
      <h2>{selected.title}</h2><p className="inbox-detail-body">{selected.body}</p>
      {task && <>
        <section className="inbox-task-summary"><span className="eyebrow">CARE DETAILS · {selected.petName.toUpperCase()}</span><h3>{task.title}</h3><dl><div><dt>When</dt><dd>{new Date(task.dueAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })} · {advice?.time}</dd></div><div><dt>{task.status === 'requested' ? 'Asked to help' : 'Responsible caregiver'}</dt><dd>{selected.assigneeName || 'Unassigned'}</dd></div><div><dt>Current status</dt><dd>{task.status === 'requested' ? 'Awaiting response' : task.status === 'done' ? 'Completed' : task.status === 'accepted' ? 'Accepted' : task.status === 'declined' ? 'Needs reassignment' : task.status === 'skipped' ? 'Not today' : 'Open'}</dd></div>{advice?.amount && <div><dt>In the instructions</dt><dd>{advice.amount}</dd></div>}</dl><p>Shared with the care circle so everyone can follow responsibility changes.</p></section>
        {selected.needsResponse && (selected.demo || canRespond(selected.petId)) && <div className="inbox-response"><button className="cancel-button" onClick={() => { if (!onRespond(selected.petId, task, false)) setError('Your response could not be saved. Please try again.'); }}>Can’t help</button><button className="primary-button" onClick={() => { if (!onRespond(selected.petId, task, true)) setError('Your response could not be saved. Please try again.'); }}>Accept task</button></div>}
        <section className="inbox-ai-card"><span className="eyebrow">✧ CARE GUIDANCE</span><h3>A little help with the handover</h3><p>{advice?.text}</p><small>From this task’s time and instructions. Confirm any changes with your caregiver.</small><button className="inbox-ask-ai" onClick={() => onAskAI(selected.petId, task)}>Ask AI about this task <span>↗</span></button></section>

        {!selected.demo && <button className="inbox-source-link" onClick={() => onOpenPlan(selected.petId)}>View current care plan <span>↗</span></button>}
      </>}
      {selected.momentId && !selected.demo && <button className="primary-button full" onClick={() => onOpenMoment(selected.petId, selected.momentId!)}>View moment in Story →</button>}
      {selected.invitationId && <button className="primary-button full" onClick={onOpenInvitations}>Review care circle invitation →</button>}
      {error && <p role="alert">{error}</p>}
    </section>;
  }
  return <section ref={pageRef} className="inbox-page">
    <header className="inbox-heading"><button className="back-button" aria-label="Back from Inbox" onClick={onBack}>←</button><h1>Inbox</h1><button className="inbox-mark-all" disabled={!unread} onClick={onReadAll}>Mark all read</button></header>
    <div className="inbox-intro"><span className="eyebrow">YOUR CARE CIRCLE, IN THE LOOP</span><p>Little updates. Better care, together.</p><span>{unread ? `${unread} unread ${unread === 1 ? 'message' : 'messages'}` : 'You’re all caught up'}</span></div>
    <div className="inbox-filters" role="tablist" aria-label="Message categories">{(['all', 'care', 'social', 'pet'] as const).map(id => <button key={id} role="tab" aria-selected={category === id} onClick={() => setCategory(id)}>{id === 'all' ? 'All' : labels[id]}{messages.some(m => !m.read && (id === 'all' || m.category === id)) && <i />}</button>)}</div>
    <div className="inbox-list-heading"><h2>{category === 'all' ? 'All messages' : labels[category]}</h2><button className={unreadOnly ? 'selected' : ''} aria-pressed={unreadOnly} onClick={() => setUnreadOnly(v => !v)}>Unread only <span>{unreadOnly ? '●' : '○'}</span></button></div>
    {!filtered.length ? <div className="inbox-empty"><InboxIcon /><h2>{unreadOnly ? 'All caught up' : 'A quiet moment'}</h2><p>{unreadOnly ? 'No unread messages in this category.' : 'Care requests, family interactions and pet updates will appear here.'}</p></div> : <div className="inbox-message-list">{filtered.map((message, index) => <div key={message.id}>
      {(index === 0 || dateLabel(filtered[index - 1].createdAt) !== dateLabel(message.createdAt)) && <h3 className="inbox-day-label">{dateLabel(message.createdAt)}</h3>}
      <button className={`inbox-message ${message.read ? '' : 'is-unread'}`} onClick={() => { onRead(message.id); setSelectedId(message.id); setError(''); }}>
        <span className={`inbox-avatar ${message.category}`}>{message.actorAvatar ? <img src={message.actorAvatar} alt="" /> : message.category === 'pet' && message.petAvatar ? <img src={message.petAvatar} alt="" /> : message.actorName.slice(0, 1)}<i>{message.category === 'care' ? '↔' : message.category === 'social' ? '♡' : '✧'}</i></span>
        <span className="inbox-message-copy"><span className="inbox-message-meta"><span>{message.demo && <span className="inbox-example-label">Message example · </span>}{message.petName} · {labels[message.category]}</span><time>{new Date(message.createdAt).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}</time></span><strong>{message.title}</strong><span className="inbox-message-preview">{message.body}</span>{message.needsResponse && <em>Needs your response</em>}</span><span className="inbox-message-end">{!message.read && <i />}<span>›</span></span>
      </button>
    </div>)}</div>}
  </section>;
}
