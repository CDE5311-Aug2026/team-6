import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from './cloud';
import { decodeSharedMoment, getOrCreateDirectChat, hideChatMessage, listChatConversations, listChatMessages, markChatRead, recallChatMessage, sendChatMessage, uploadChatAttachment, type ChatAttachment, type ChatConversation, type ChatMessage } from './chatApi';

type ChatMember = { id: string; name: string; avatar?: string; role?: string };
type Props = { groupId?: string; groupName: string; petId?: string; petName: string; currentUserId: string; members: ChatMember[]; enabled: boolean; hidden?: boolean; activeConversationId?: string; onActiveConversationChange?: (id: string) => void; onOpenCareCircle?: () => void; onOpenCareMember?: (memberId: string) => void; onUnreadChange?: (count: number) => void; onOpenSharedMoment?: (momentId: string, destination: 'story' | 'activity-summary') => void };
const stamp = (value: string) => new Date(value).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
const availabilityState: Record<string, { icon: string; label: string }> = {
  home: { icon: '🏠', label: 'At home' },
  away: { icon: '🚶', label: 'Away' },
  busy: { icon: '🔕', label: 'Busy' },
  available: { icon: '😊', label: 'Available' },
};
function getMemberAvailability(name: string) {
  try { return availabilityState[localStorage.getItem(`pawsona-availability:${name}`) || 'home'] ?? availabilityState.home; }
  catch { return availabilityState.home; }
}

export default function InboxChats({ groupId, groupName, petId, petName, currentUserId, members, enabled, hidden = false, activeConversationId, onActiveConversationChange, onOpenCareCircle, onOpenCareMember, onUnreadChange, onOpenSharedMoment }: Props) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [localActiveId, setLocalActiveId] = useState('');
  const activeId = activeConversationId ?? localActiveId;
  const setActiveId = (id: string) => { setLocalActiveId(id); onActiveConversationChange?.(id); };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [openMessageMenu, setOpenMessageMenu] = useState('');
  const [pendingRecall, setPendingRecall] = useState<ChatMessage | null>(null);
  const [recording, setRecording] = useState(false);
  const [choosingMember, setChoosingMember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, setAvailabilityVersion] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const recallCancelRef = useRef<HTMLButtonElement>(null);
  const recallConfirmRef = useRef<HTMLButtonElement>(null);
  const recallReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  useEffect(() => {
    const refreshAvailability = () => setAvailabilityVersion(version => version + 1);
    window.addEventListener('storage', refreshAvailability);
    window.addEventListener('pawsona-availability-change', refreshAvailability);
    return () => {
      window.removeEventListener('storage', refreshAvailability);
      window.removeEventListener('pawsona-availability-change', refreshAvailability);
    };
  }, []);
  const active = conversations.find(conversation => conversation.id === activeId);
  const member = (id: string) => members.find(candidate => candidate.id === id);
  const participant = (conversation: ChatConversation) => conversation.memberIds.find(id => id !== currentUserId);
  const title = (conversation: ChatConversation) => conversation.kind === 'group' ? `${groupName} chat` : member(participant(conversation) ?? '')?.name ?? 'Caregiver';
  const avatar = (conversation: ChatConversation) => conversation.kind === 'group' ? '' : member(participant(conversation) ?? '')?.avatar ?? '';
  const preview = (conversation: ChatConversation) => {
    const message = conversation.lastMessage;
    if (!message) return conversation.kind === 'group' ? 'Start a conversation with the group' : 'Start a private conversation';
    const prefix = message.senderId === currentUserId ? 'You: ' : '';
    if (message.deletedAt) return `${prefix}Message was recalled`;
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
      if (activeId && !result.some(item => item.id === activeId)) setActiveId('');
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_messages' }, async payload => {
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
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'care_conversation_members' }, async payload => {
        const row = payload.new as { conversation_id?: string };
        if (activeId && row.conversation_id === activeId) {
          const latest = await listChatMessages(activeId).catch(() => null);
          if (latest) setMessages(latest);
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

  useEffect(() => {
    if (!pendingRecall) {
      const returnFocus = recallReturnFocusRef.current;
      if (returnFocus) requestAnimationFrame(() => returnFocus.focus());
      recallReturnFocusRef.current = null;
      return;
    }
    recallCancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setPendingRecall(null); }
      if (event.key === 'Tab') {
        event.preventDefault();
        (event.shiftKey ? recallCancelRef.current : recallConfirmRef.current)?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingRecall]);

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
    if (!activeId || (!draft.trim() && !attachment) || busy) return;
    const body = draft.trim();
    setBusy(true); setError('');
    try {
      const message = await sendChatMessage(activeId, body, attachment, replyingTo?.id);
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      setDraft('');
      setAttachment(null);
      setReplyingTo(null);
      await refreshConversations();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message could not be sent. Please try again.'); }
    finally { setBusy(false); }
  }

  async function chooseAttachment(file?: File) {
    if (!file || !activeId) return;
    setBusy(true); setError('');
    try { setAttachment(await uploadChatAttachment(activeId, file)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'File could not be attached.'); }
    finally { setBusy(false); }
  }

  async function toggleRecording() {
    if (recording) { recorderRef.current?.stop(); setRecording(false); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Voice recording is not supported in this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder; chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 12 * 1024 * 1024) { setError('Choose a voice recording shorter than 12 MB.'); return; }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        void chooseAttachment(file);
      };
      recorder.start(); setRecording(true); setError('');
    } catch { setError('Microphone access is needed to record a voice message.'); }
  }

  async function recall(message: ChatMessage) {
    if (busy) return;
    setPendingRecall(null);
    setBusy(true); setError('');
    try { await recallChatMessage(message.id); setMessages(await listChatMessages(activeId)); await refreshConversations(); }
    catch (cause) {
      const detail = cause instanceof Error ? cause.message : '';
      setError(/row-level security|policy|10 minutes|recall window/i.test(detail) ? 'This message is older than 10 minutes and can no longer be recalled.' : detail || 'Message could not be recalled.');
    }
    finally { setOpenMessageMenu(''); setBusy(false); }
  }

  async function deleteForMe(message: ChatMessage) {
    if (busy || !window.confirm('Delete this message only from your account? Other members will still see it.')) return;
    setBusy(true); setError('');
    try {
      await hideChatMessage(message.id);
      setMessages(await listChatMessages(activeId));
      if (replyingTo?.id === message.id) setReplyingTo(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message could not be deleted from your account.'); }
    finally { setOpenMessageMenu(''); setBusy(false); }
  }

  function quote(message: ChatMessage) {
    setReplyingTo(message);
    setOpenMessageMenu('');
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  if (!enabled || !groupId) return <div className="chat-unavailable" hidden={hidden} style={hidden ? { display: 'none' } : undefined}><span aria-hidden="true">✉</span><h2>Chats are for your care circle</h2><p>Sign in and open a pet shared with your care group to message its members.</p></div>;

  const peerId = active && active.kind !== 'group' ? participant(active) : undefined;
  const peer = peerId ? member(peerId) : undefined;
  const peerAvailability = peer ? getMemberAvailability(peer.name) : undefined;

  if (active) return <section className="inbox-chat-thread" hidden={hidden} style={hidden ? { display: 'none' } : undefined}>
    <header className="chat-thread-heading"><button type="button" className="back-button" onClick={() => { setActiveId(''); void refreshConversations(); }} aria-label="Back to chats">←</button>{active.kind === 'group' ? <button type="button" className="chat-thread-avatar is-clickable" onClick={onOpenCareCircle} aria-label={`View ${petName} care circle members`} title="View care circle members">{avatar(active) ? <img src={avatar(active)} alt="" /> : '✦'}</button> : peer ? <button type="button" className="chat-thread-avatar is-clickable" onClick={() => peerId && onOpenCareMember?.(peerId)} aria-label={`View ${peer.name} account details`} title={`View ${peer.name} account details`}>{avatar(active) ? <img src={avatar(active)} alt="" /> : peer.name.slice(0, 1).toUpperCase()}</button> : <span className="chat-thread-avatar">{avatar(active) ? <img src={avatar(active)} alt="" /> : title(active).slice(0, 1).toUpperCase()}</span>}<span><span className="chat-thread-title-row"><strong>{title(active)}</strong>{peerAvailability && <span className="chat-availability-badge" aria-label={peerAvailability.label}>{peerAvailability.icon} {peerAvailability.label}</span>}</span><small>{active.kind === 'group' ? `${members.length} members · ${petName} care circle` : 'Private chat'}</small></span></header>
    <div className="chat-thread-notice">Messages are shared only with members of this care circle.</div>
    <div className="chat-thread-messages" aria-live="polite">
      {!messages.length && <p className="chat-thread-empty">Start the conversation with {active.kind === 'group' ? 'your care circle' : title(active)}.</p>}
      {messages.map(message => {
        const sharedMoment = decodeSharedMoment(message.body);
        return <article key={message.id} className={`chat-bubble ${message.senderId === currentUserId ? 'mine' : ''} ${openMessageMenu === message.id ? 'menu-open' : ''}`}>
          {active.kind === 'group' && message.senderId !== currentUserId && <small>{member(message.senderId)?.name ?? 'Caregiver'}</small>}
          {message.replyTo && <div className="chat-reply-preview"><strong>{member(message.replyTo.senderId)?.name ?? 'Caregiver'}</strong><span>{message.replyTo.deletedAt ? 'Message was recalled.' : decodeSharedMoment(message.replyTo.body)?.title ?? message.replyTo.body}</span></div>}
          {message.deletedAt ? <p className="chat-recalled">This message was recalled.</p> : <>
            {sharedMoment ? <button type="button" className="chat-shared-moment" aria-label={`Open ${sharedMoment.title} in ${sharedMoment.destination === 'activity-summary' ? 'activity summary' : `${sharedMoment.petName}’s Story`}`} onClick={() => onOpenSharedMoment?.(sharedMoment.id, sharedMoment.destination)} disabled={!onOpenSharedMoment || !petId}><span className="chat-shared-label">{sharedMoment.destination === 'activity-summary' ? 'Shared an activity summary' : 'Shared a Story moment'}</span>{sharedMoment.image && <span className="chat-shared-image">{sharedMoment.mediaType?.startsWith('video/') ? <video src={sharedMoment.image} muted playsInline /> : <img src={sharedMoment.image} alt="" />}</span>}<span className="chat-shared-copy"><strong>{sharedMoment.title}</strong><small>{sharedMoment.petName} · {sharedMoment.time}</small><span className="chat-shared-description">{sharedMoment.description}</span>{sharedMoment.details?.map(detail => <small className="chat-shared-detail" key={detail}>{detail}</small>)}<small className="chat-shared-open-label">{sharedMoment.destination === 'activity-summary' ? 'Open activity summary →' : 'Open in Story →'}</small></span></button> : null}
            {message.attachment?.url && <div className="chat-attachment">{message.attachment.mimeType.startsWith('image/') ? <img src={message.attachment.url} alt={message.attachment.name} /> : message.attachment.mimeType.startsWith('video/') ? <video src={message.attachment.url} controls playsInline /> : <audio src={message.attachment.url} controls />}</div>}
            {message.body && !sharedMoment && <p>{message.body}</p>}
          </>}
          <time>{stamp(message.createdAt)}</time>
          <div className="chat-message-menu-wrap">
            <button type="button" className="chat-message-menu-trigger" aria-label="Message actions" aria-expanded={openMessageMenu === message.id} onClick={() => setOpenMessageMenu(value => value === message.id ? '' : message.id)}>•••</button>
            {openMessageMenu === message.id && <div className="chat-message-menu">
              {!message.deletedAt && <button type="button" disabled={busy} onClick={() => quote(message)}>Quote</button>}
              {message.senderId === currentUserId && !message.deletedAt && <button type="button" disabled={busy} onClick={event => { recallReturnFocusRef.current = event.currentTarget.closest('.chat-message-menu-wrap')?.querySelector<HTMLButtonElement>('.chat-message-menu-trigger') ?? null; setPendingRecall(message); setOpenMessageMenu(''); }}>Recall</button>}
              <button type="button" disabled={busy} onClick={() => void deleteForMe(message)}>Delete for me</button>
            </div>}
          </div>
          {message.senderId === currentUserId && !!message.readByIds?.length && <small className="chat-read-by">Read by {message.readByIds.map(id => member(id)?.name ?? 'Caregiver').join(', ')}</small>}
        </article>;
      })}
      <div ref={bottomRef} />
    </div>
    <div className="chat-composer-dock">
    {error && <p className="chat-error" role="alert">{error}</p>}
    {attachment && <div className="chat-attachment-pending"><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">×</button></div>}
    {replyingTo && <div className="chat-replying-to"><span><strong>Replying to {member(replyingTo.senderId)?.name ?? 'Caregiver'}</strong><small>{replyingTo.deletedAt ? 'Message was recalled.' : decodeSharedMoment(replyingTo.body)?.title ?? replyingTo.body}</small></span><button type="button" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}>×</button></div>}
    <form className="chat-composer" onSubmit={event => void submit(event)}>
      <textarea ref={composerRef} aria-label="Write a message" placeholder={recording ? 'Recording voice message…' : 'Write a message…'} maxLength={4000} rows={2} value={draft} onChange={event => setDraft(event.target.value)} />
      <div className="chat-composer-tools">
        <button type="button" disabled={busy || recording} onClick={() => imageInputRef.current?.click()} aria-label="Attach a photo or video" title="Attach a photo or video">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>
        </button>
        <button type="button" className={recording ? 'recording' : ''} disabled={busy} onClick={() => void toggleRecording()} aria-label={recording ? 'Stop voice recording' : 'Record a voice message'} title={recording ? 'Stop recording' : 'Record a voice message'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>
        </button>
      </div>
      <input ref={imageInputRef} hidden type="file" accept="image/*,video/*" onChange={event => { void chooseAttachment(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <button className="primary-button" disabled={busy || recording || (!draft.trim() && !attachment)} aria-label="Send message">Send</button>
    </form>
    </div>
    {pendingRecall && <div className="chat-recall-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPendingRecall(null); }}><section className="chat-recall-dialog" role="alertdialog" aria-modal="true" aria-labelledby="chat-recall-title" aria-describedby="chat-recall-description"><span className="eyebrow">MESSAGE ACTION</span><h2 id="chat-recall-title">Recall this message?</h2><p id="chat-recall-description">This will remove the message for everyone in the conversation.</p><div className="chat-recall-actions"><button ref={recallCancelRef} type="button" className="cancel-button" onClick={() => setPendingRecall(null)}>Cancel</button><button ref={recallConfirmRef} type="button" className="primary-button" disabled={busy} onClick={() => void recall(pendingRecall)}>Recall message</button></div></section></div>}
  </section>;

  return <section className="inbox-chats" hidden={hidden} style={hidden ? { display: 'none' } : undefined}>
    <div className="chat-list-heading"><div><h2>Chats</h2><p>Stay in touch with {petName}’s care circle.</p></div><button className="chat-new-button" type="button" onClick={() => setChoosingMember(value => !value)}>{choosingMember ? 'Done' : '＋ New chat'}</button></div>
    {choosingMember && <div className="chat-new-choices"><h3>Start a private chat</h3>{members.filter(candidate => candidate.id !== currentUserId).length ? members.filter(candidate => candidate.id !== currentUserId).map(candidate => <button key={candidate.id} type="button" disabled={busy} onClick={() => void startDirect(candidate.id)}><span className="chat-list-avatar">{candidate.avatar ? <img src={candidate.avatar} alt="" /> : candidate.name.slice(0, 1).toUpperCase()}</span><span><strong>{candidate.name}</strong><small>{candidate.role ?? 'Caregiver'}</small></span><b>›</b></button>) : <p>Invite another caregiver to start a private chat.</p>}</div>}
    {error && <p className="chat-error" role="alert">{error}</p>}
    {!conversations.length && !error ? <div className="chat-empty"><span aria-hidden="true">✉</span><h3>Your care circle chat will appear here</h3><p>Group chat starts when the latest messaging setup is available.</p></div> : <div className="chat-conversation-list">{conversations.map(conversation => <button type="button" className="chat-conversation-row" key={conversation.id} onClick={() => setActiveId(conversation.id)}>
      <span className={`chat-list-avatar ${conversation.kind}`}>{avatar(conversation) ? <img src={avatar(conversation)} alt="" /> : conversation.kind === 'group' ? '✦' : title(conversation).slice(0, 1).toUpperCase()}</span>
      <span className="chat-conversation-copy"><span className="chat-conversation-title"><strong>{title(conversation)}</strong>{conversation.kind === 'direct' && (() => { const peer = member(participant(conversation) ?? ''); if (!peer) return null; const status = getMemberAvailability(peer.name); return <span className="chat-availability-icon" role="img" aria-label={status.label} title={status.label}>{status.icon}</span>; })()}</span><small>{preview(conversation)}</small></span>
      <span className="chat-conversation-meta">{conversation.lastMessageAt && <time>{stamp(conversation.lastMessageAt)}</time>}{conversation.unreadCount > 0 && <b>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</b>}<i>›</i></span>
    </button>)}</div>}
    <p className="chat-group-note">Care requests and task updates stay in Updates, so they remain easy to find.</p>
  </section>;
}

