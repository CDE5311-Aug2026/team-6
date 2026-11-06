import { useEffect, useState } from 'react';
import { encodeSharedMoment, getOrCreateDirectChat, listChatConversations, sendChatMessage, type ChatConversation } from './chatApi';

type Member = { id: string; name: string; avatar?: string; role?: string };
type Moment = { id: string; title: string; time: string; description: string; image: string; mediaType?: string; details?: string[] };
type Props = { moment: Moment; petName: string; groupId?: string; groupName: string; currentUserId: string; members: Member[]; destination?: 'story' | 'activity-summary'; onClose: () => void };
type ShareTarget = { id: string; memberId?: string; name: string; subtitle: string; avatar?: string; group?: boolean };

export default function MomentShareDialog({ moment, petName, groupId, groupName, currentUserId, members, destination = 'story', onClose }: Props) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [pendingTarget, setPendingTarget] = useState<ShareTarget | null>(null);
  const [error, setError] = useState('');
  const groupConversation = conversations.find(conversation => conversation.kind === 'group');

  useEffect(() => {
    let active = true;
    void listChatConversations(groupId ?? '').then(result => { if (active) setConversations(result); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Chats could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [groupId]);

  async function share() {
    if (!pendingTarget) return;
    if (!groupId || busyId) return;
    setBusyId(pendingTarget.id); setError('');
    try {
      const conversationId = pendingTarget.memberId ? await getOrCreateDirectChat(groupId, pendingTarget.memberId) : pendingTarget.id;
      const safeImage = moment.image && moment.image.length <= 1200 && (/^https?:\/\//i.test(moment.image) || moment.image.startsWith('/')) ? moment.image : undefined;
      const body = encodeSharedMoment({ id: moment.id, destination, title: moment.title.slice(0, 120), petName: petName.slice(0, 60), time: moment.time.slice(0, 120), description: moment.description.slice(0, 900), image: safeImage, mediaType: moment.mediaType?.slice(0, 100), details: moment.details?.slice(0, 8).map(detail => detail.slice(0, 120)) });
      await sendChatMessage(conversationId, body);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This moment could not be shared. Please try again.'); }
    finally { setBusyId(''); }
  }

  return <div className="moment-share-backdrop" role="presentation" onClick={onClose}>
    <section className="moment-share-dialog" role="dialog" aria-modal="true" aria-labelledby="moment-share-title" onClick={event => event.stopPropagation()}>
      <header><div><span className="eyebrow">SHARE WITH YOUR CARE CIRCLE</span><h2 id="moment-share-title">Share this moment</h2></div><button type="button" aria-label="Close sharing options" onClick={onClose}>×</button></header>
      <article className="moment-share-preview">
        {moment.image && <span className="moment-share-preview-image">{moment.mediaType?.startsWith('video/') ? <video src={moment.image} muted playsInline /> : <img src={moment.image} alt="" />}</span>}
        <span><strong>{moment.title}</strong><small>{petName} · {moment.time}</small><p>{moment.description}</p></span>
      </article>
      {loading ? <p className="moment-share-status">Loading your care circle…</p> : pendingTarget ? <section className="moment-share-confirmation" aria-live="polite"><h3>Send this moment?</h3><p>This Story moment will be shared with:</p><div className="moment-share-confirm-target"><span className={pendingTarget.group ? 'moment-share-group-avatar' : 'moment-share-avatar'}>{pendingTarget.avatar ? <img src={pendingTarget.avatar} alt="" /> : pendingTarget.group ? '✦' : pendingTarget.name.slice(0, 1).toUpperCase()}</span><span><strong>{pendingTarget.name}</strong><small>{pendingTarget.subtitle}</small></span></div><div className="moment-share-confirm-actions"><button className="cancel-button" type="button" disabled={!!busyId} onClick={() => setPendingTarget(null)}>Back</button><button className="primary-button" type="button" disabled={!!busyId} onClick={() => void share()}>{busyId ? 'Sending…' : 'Send moment'}</button></div></section> : <div className="moment-share-recipients">
        {groupConversation && <button type="button" className="moment-share-recipient" onClick={() => setPendingTarget({ id: groupConversation.id, name: `${groupName} chat`, subtitle: 'Everyone in the group', group: true })}><span className="moment-share-group-avatar">✦</span><span><strong>{groupName} chat</strong><small>Share with everyone in the group</small></span><b>›</b></button>}
        {members.filter(member => member.id !== currentUserId).map(member => <button type="button" className="moment-share-recipient" key={member.id} onClick={() => setPendingTarget({ id: member.id, memberId: member.id, name: member.name, subtitle: `${member.role || 'Caregiver'} · private chat`, avatar: member.avatar })}><span className="moment-share-avatar">{member.avatar ? <img src={member.avatar} alt="" /> : member.name.slice(0, 1).toUpperCase()}</span><span><strong>{member.name}</strong><small>{member.role || 'Caregiver'} · private chat</small></span><b>›</b></button>)}
        {!groupConversation && !members.some(member => member.id !== currentUserId) && <p className="moment-share-status">No other care-circle members are available to share with.</p>}
      </div>}
      {error && <p className="chat-error" role="alert">{error}</p>}
      <button className="cancel-button moment-share-cancel" type="button" onClick={onClose}>Cancel</button>
    </section>
  </div>;
}
