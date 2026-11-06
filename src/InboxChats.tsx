import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from './cloud';
import { decodeSharedMoment, getOrCreateDirectChat, listChatConversations, listChatMessages, markChatRead, sendChatMessage, type ChatConversation, type ChatMessage } from './chatApi';

type ChatMember = { id: string; name: string; avatar?: string; role?: string };
type Props = { groupId?: string; groupName: string; petId?: string; petName: string; currentUserId: string; members: ChatMember[]; enabled: boolean; hidden?: boolean; onUnreadChange?: (count: number) => void; onOpenSharedMoment?: (momentId: string, destination: 'story' | 'activity-summary') => void };
const stamp = (value: string) => new Date(value).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });

export default function InboxChats({ groupId, groupName, petId, petName, currentUserId, members, enabled, hidden = false, onUnreadChange, onOpenSharedMoment }: Props) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [choosingMember, setChoosingMember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const active = conversations.find(conversation => conversation.id === activeId);
  const member = (id: string) => members.find(candidate => candidate.id === id);
  const participant = (conversation: ChatConversation) => conversation.memberIds.find(id => id !== currentUserId);
  const title = (conversation: ChatConversation) => conversation.kind === 'group' ? `${groupName} chat` : member(participant(conversation) ?? '')?.name ?? 'Caregiver';
  const avatar = (conversation: ChatConversation) => conversation.kind === 'group' ? '' : member(participant(conversation) ?? '')?.avatar ?? '';
  const preview = (conversation: ChatConversation) => {
    const message = conversation.lastMessage;
    if (!message) return conversation.kind === 'group' ? 'Start a conversation with the group' : 'Start a private conversation';
    const prefix = message.senderId === currentUserId ? 'You: ' : '';
    const sharedMoment = decodeSharedMoment(message.body);
    if (sharedMoment) return `${prefix}${sharedMoment.destination === 'activity-summary' ? 'Shared an activity summary' : 'Shared a Story moment'}: ${sharedMoment.title}`;
    return `${prefix}${message.body}`;
  };

  async function refreshConversations() {
    if (!enabled || !groupId) return [] as ChatConversation[];
    try {
      const result = await listChatConversations(groupId);
      setConversations(result);
      onUnreadChange?.(result.reduce((total, item) => total + item.unreadCount, 0));
      if (!activeId && result.some(item => item.kind === 'group')) setActiveId('');
      setError('');
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chats could not be loaded. Please try again.');
      return [] as ChatConversation[];
    }
  }

  useEffect(() => { void refreshConversations(); }, [enabled, groupId, activeId]);

  useEffect(() => {
    const client = supabase;
    if (!enabled || !groupId || !client) return;
    const channel = client.channel(`care-chat-inbox:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'care_messages' }, async payload => {
        const row = payload.new as { conversation_id?: string };
        const latestConversations = await refreshConversations();
        if (activeId && row.conversation_id === activeId) {
          const latest = await listChatMessages(activeId).catch(() => null);
          if (latest) setMessages(latest);
          await markChatRead(activeId).catch(() => undefined);
          const unreadInActive = latestConversations.find(item => item.id === activeId)?.unreadCount ?? 0;
          setConversations(current => current.map(item => item.id === activeId ? { ...item, unreadCount: 0 } : item));
          onUnreadChange?.(Math.max(0, latestConversations.reduce((total, item) => total + item.unreadCount, 0) - unreadInActive));
        }
      }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [enabled, groupId, activeId]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let live = true;
    setError('');
    void (async () => {
      const items = await listChatMessages(activeId);
      await markChatRead(activeId);
      if (!live) return;
      const cleared = conversations.find(item => item.id === activeId)?.unreadCount ?? 0;
      setMessages(items);
      setConversations(current => current.map(item => item.id === activeId ? { ...item, unreadCount: 0 } : item));
      onUnreadChange?.(Math.max(0, conversations.reduce((total, item) => total + item.unreadCount, 0) - cleared));
    })().catch(cause => { if (live) setError(cause instanceof Error ? cause.message : 'Messages could not be loaded.'); });
    return () => { live = false; };
  }, [activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages.length, activeId]);

  async function startDirect(memberId: string) {
    if (!groupId) return;
    setBusy(true); setError('');
    try {
      const id = await getOrCreateDirectChat(groupId, memberId);
      await refreshConversations();
      setChoosingMember(false);
      setActiveId(id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start this chat.'); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!activeId || !draft.trim() || busy) return;
    const body = draft.trim();
    setBusy(true); setError('');
    try {
      const message = await sendChatMessage(activeId, body);
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      setDraft('');
      await refreshConversations();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message could not be sent. Please try again.'); }
    finally { setBusy(false); }
  }

  if (!enabled || !groupId) return <div className="chat-unavailable" hidden={hidden} style={hidden ? { display: 'none' } : undefined}><span aria-hidden="true">✉</span><h2>Chats are for your care circle</h2><p>Sign in and open a pet shared with your care group to message its members.</p></div>;

  if (active) return <section className="inbox-chat-thread" hidden={hidden} style={hidden ? { display: 'none' } : undefined}>
    <header className="chat-thread-heading"><button type="button" className="back-button" onClick={() => { setActiveId(''); void refreshConversations(); }} aria-label="Back to chats">←</button><span className="chat-thread-avatar">{avatar(active) ? <img src={avatar(active)} alt="" /> : active.kind === 'group' ? '✦' : title(active).slice(0, 1).toUpperCase()}</span><span><strong>{title(active)}</strong><small>{active.kind === 'group' ? `${members.length} members · ${petName} care circle` : 'Private chat'}</small></span></header>
    <div className="chat-thread-notice">Messages are shared only with members of this care circle.</div>
    <div className="chat-thread-messages" aria-live="polite">
      {!messages.length && <p className="chat-thread-empty">Start the conversation with {active.kind === 'group' ? 'your care circle' : title(active)}.</p>}
      {messages.map(message => {
        const sharedMoment = decodeSharedMoment(message.body);
        return <article key={message.id} className={`chat-bubble ${message.senderId === currentUserId ? 'mine' : ''}`}>
          {active.kind === 'group' && message.senderId !== currentUserId && <small>{member(message.senderId)?.name ?? 'Caregiver'}</small>}
          {sharedMoment ? <button type="button" className="chat-shared-moment" aria-label={`Open ${sharedMoment.title} in ${sharedMoment.destination === 'activity-summary' ? 'activity summary' : `${sharedMoment.petName}’s Story`}`} onClick={() => onOpenSharedMoment?.(sharedMoment.id, sharedMoment.destination)} disabled={!onOpenSharedMoment || !petId}><span className="chat-shared-label">{sharedMoment.destination === 'activity-summary' ? 'Shared an activity summary' : 'Shared a Story moment'}</span>{sharedMoment.image && <span className="chat-shared-image">{sharedMoment.mediaType?.startsWith('video/') ? <video src={sharedMoment.image} muted playsInline /> : <img src={sharedMoment.image} alt="" />}</span>}<span className="chat-shared-copy"><strong>{sharedMoment.title}</strong><small>{sharedMoment.petName} · {sharedMoment.time}</small><span className="chat-shared-description">{sharedMoment.description}</span>{sharedMoment.details?.map(detail => <small className="chat-shared-detail" key={detail}>{detail}</small>)}<small className="chat-shared-open-label">{sharedMoment.destination === 'activity-summary' ? 'Open activity summary →' : 'Open in Story →'}</small></span></button> : <p>{message.body}</p>}
          <time>{stamp(message.createdAt)}</time>
        </article>;
      })}
      <div ref={bottomRef} />
    </div>
    {error && <p className="chat-error" role="alert">{error}</p>}
    <form className="chat-composer" onSubmit={event => void submit(event)}><textarea aria-label="Write a message" placeholder="Write a message…" maxLength={4000} rows={2} value={draft} onChange={event => setDraft(event.target.value)} /><button className="primary-button" disabled={busy || !draft.trim()} aria-label="Send message">Send</button></form>
  </section>;

  return <section className="inbox-chats" hidden={hidden} style={hidden ? { display: 'none' } : undefined}>
    <div className="chat-list-heading"><div><h2>Chats</h2><p>Stay in touch with {petName}’s care circle.</p></div><button className="chat-new-button" type="button" onClick={() => setChoosingMember(value => !value)}>{choosingMember ? 'Done' : '＋ New chat'}</button></div>
    {choosingMember && <div className="chat-new-choices"><h3>Start a private chat</h3>{members.filter(candidate => candidate.id !== currentUserId).length ? members.filter(candidate => candidate.id !== currentUserId).map(candidate => <button key={candidate.id} type="button" disabled={busy} onClick={() => void startDirect(candidate.id)}><span className="chat-list-avatar">{candidate.avatar ? <img src={candidate.avatar} alt="" /> : candidate.name.slice(0, 1).toUpperCase()}</span><span><strong>{candidate.name}</strong><small>{candidate.role ?? 'Caregiver'}</small></span><b>›</b></button>) : <p>Invite another caregiver to start a private chat.</p>}</div>}
    {error && <p className="chat-error" role="alert">{error}</p>}
    {!conversations.length && !error ? <div className="chat-empty"><span aria-hidden="true">✉</span><h3>Your care circle chat will appear here</h3><p>Group chat starts when the latest messaging setup is available.</p></div> : <div className="chat-conversation-list">{conversations.map(conversation => <button type="button" className="chat-conversation-row" key={conversation.id} onClick={() => setActiveId(conversation.id)}>
      <span className={`chat-list-avatar ${conversation.kind}`}>{avatar(conversation) ? <img src={avatar(conversation)} alt="" /> : conversation.kind === 'group' ? '✦' : title(conversation).slice(0, 1).toUpperCase()}</span>
      <span className="chat-conversation-copy"><strong>{title(conversation)}</strong><small>{preview(conversation)}</small></span>
      <span className="chat-conversation-meta">{conversation.lastMessageAt && <time>{stamp(conversation.lastMessageAt)}</time>}{conversation.unreadCount > 0 && <b>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</b>}<i>›</i></span>
    </button>)}</div>}
    <p className="chat-group-note">Care requests and task updates stay in Updates, so they remain easy to find.</p>
  </section>;
}
