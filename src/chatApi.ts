import { supabase, verifiedUser } from './cloud';

export type ChatConversation = { id: string; kind: 'group' | 'direct'; groupId: string; updatedAt: string; lastMessageAt: string | null; memberIds: string[]; lastMessage?: ChatMessage; unreadCount: number };
export type ChatAttachment = { path: string; name: string; mimeType: string; size: number; url?: string };
export type ChatMessage = { id: string; conversationId: string; senderId: string; body: string; createdAt: string; deletedAt?: string | null; attachment?: ChatAttachment | null; readByIds?: string[]; replyTo?: { id: string; senderId: string; body: string; deletedAt?: string | null } | null };

const MOMENT_SHARE_PREFIX = 'PAWSONA_MOMENT_SHARE:';
export type SharedMomentCard = { id: string; destination: 'story' | 'activity-summary'; title: string; petName: string; time: string; description: string; image?: string; mediaType?: string; details?: string[] };
export function encodeSharedMoment(card: SharedMomentCard) { return `${MOMENT_SHARE_PREFIX}${JSON.stringify(card)}`; }
export function decodeSharedMoment(body: string): SharedMomentCard | null {
  if (!body.startsWith(MOMENT_SHARE_PREFIX)) return null;
  try {
    const value = JSON.parse(body.slice(MOMENT_SHARE_PREFIX.length)) as Partial<SharedMomentCard>;
    if (typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.petName !== 'string' || typeof value.time !== 'string' || typeof value.description !== 'string') return null;
    return { id: value.id, destination: value.destination === 'activity-summary' ? 'activity-summary' : 'story', title: value.title, petName: value.petName, time: value.time, description: value.description,
      image: typeof value.image === 'string' ? value.image : undefined,
      mediaType: typeof value.mediaType === 'string' ? value.mediaType : undefined,
      details: Array.isArray(value.details) ? value.details.filter((detail): detail is string => typeof detail === 'string').slice(0, 8) : undefined };
  } catch { return null; }
}

export async function listChatConversations(groupId: string): Promise<ChatConversation[]> {
  const client = supabase;
  if (!client) return [];
  const user = await verifiedUser();
  const { data, error } = await client.from('care_conversations').select('id,kind,group_id,updated_at,last_message_at').eq('group_id', groupId).order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.code === '42P01' || error.code === 'PGRST205' ? 'Chat setup is not complete yet. Apply the care group chat migration, then refresh.' : error.message);
  const rows = data ?? [];
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const [{ data: memberRows, error: memberError }, { data: messageRows, error: messageError }] = await Promise.all([
    client.from('care_conversation_members').select('conversation_id,user_id,last_read_at').in('conversation_id', ids),
    client.from('care_messages').select('id,conversation_id,sender_id,body,created_at,deleted_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(500),
  ]);
  if (memberError) throw memberError;
  if (messageError) throw messageError;
  const messageIds = (messageRows ?? []).map(row => row.id);
  const { data: hiddenRows, error: hiddenError } = messageIds.length
    ? await client.from('care_message_hidden').select('message_id').in('message_id', messageIds)
    : { data: [], error: null };
  if (hiddenError) throw hiddenError;
  const hiddenIds = new Set((hiddenRows ?? []).map(item => item.message_id));
  const messages = (messageRows ?? []).filter(row => !hiddenIds.has(row.id)).map(row => ({ id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at, deletedAt: row.deleted_at }));
  return Promise.all(rows.map(async row => {
    const members = (memberRows ?? []).filter(member => member.conversation_id === row.id);
    const ownMembership = members.find(member => member.user_id === user.id);
    const lastMessage = messages.find(message => message.conversationId === row.id);
    let unreadCount = 0;
    if (ownMembership) {
      const { count, error: countError } = await client.from('care_messages').select('id', { count: 'exact', head: true })
        .eq('conversation_id', row.id).neq('sender_id', user.id).gt('created_at', ownMembership.last_read_at);
      if (countError) throw countError;
      unreadCount = count ?? 0;
    }
    return { id: row.id, kind: row.kind, groupId: row.group_id, updatedAt: row.updated_at, lastMessageAt: row.last_message_at,
      memberIds: members.map(member => member.user_id), lastMessage,
      unreadCount };
  }));
}

export async function getOrCreateDirectChat(groupId: string, otherUserId: string): Promise<string> {
  const client = supabase;
  if (!client) throw new Error('Log in to start a chat.');
  const { data, error } = await client.rpc('get_or_create_care_direct_conversation', { p_group_id: groupId, p_other_user_id: otherUserId });
  if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883' ? 'Chat setup is not complete yet. Apply the care group chat migration, then refresh.' : error.message);
  return String(data);
}

export async function listChatMessages(conversationId: string): Promise<ChatMessage[]> {
  const client = supabase;
  if (!client) return [];
  const [{ data, error }, { data: memberRows, error: memberError }] = await Promise.all([
    client.from('care_messages').select('id,conversation_id,sender_id,body,created_at,deleted_at,attachment,reply_to_id').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(100),
    client.from('care_conversation_members').select('user_id,last_read_at').eq('conversation_id', conversationId),
  ]);
  if (error) throw error;
  if (memberError) throw memberError;
  const rows = data ?? [];
  const messageIds = rows.map(row => row.id);
  const { data: hiddenRows, error: hiddenError } = messageIds.length
    ? await client.from('care_message_hidden').select('message_id').in('message_id', messageIds)
    : { data: [], error: null };
  if (hiddenError) throw hiddenError;
  const hiddenIds = new Set((hiddenRows ?? []).map(row => row.message_id));
  const visibleRows = rows.filter(row => !hiddenIds.has(row.id));
  const rowById = new Map(rows.map(row => [row.id, row]));
  return Promise.all(visibleRows.map(async row => {
    const attachment = row.attachment as ChatAttachment | null;
    let resolved = attachment;
    if (attachment?.path) {
      const { data: signed, error: signedError } = await client.storage.from('care-chat-media').createSignedUrl(attachment.path, 3600);
      if (signedError) throw signedError;
      resolved = { ...attachment, url: signed.signedUrl };
    }
    const readByIds = (memberRows ?? []).filter(item => item.user_id !== row.sender_id && item.last_read_at >= row.created_at).map(item => item.user_id);
    const replyRow = row.reply_to_id ? rowById.get(row.reply_to_id) : undefined;
    return { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at,
      deletedAt: row.deleted_at, attachment: resolved, readByIds,
      replyTo: replyRow && !hiddenIds.has(replyRow.id) ? { id: replyRow.id, senderId: replyRow.sender_id, body: replyRow.body, deletedAt: replyRow.deleted_at } : null };
  }));
}

export async function uploadChatAttachment(conversationId: string, file: File): Promise<ChatAttachment> {
  const client = supabase;
  if (!client) throw new Error('Log in to send a message.');
  const user = await verifiedUser();
  const allowed = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/');
  if (!allowed) throw new Error('Choose an image, video, or audio recording.');
  const maxBytes = file.type.startsWith('video/') ? 30 * 1024 * 1024 : 12 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error(file.type.startsWith('video/') ? 'Choose a video smaller than 30 MB.' : 'Choose a file smaller than 12 MB.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'attachment';
  const path = `${conversationId}/${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await client.storage.from('care-chat-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data: signed, error: signedError } = await client.storage.from('care-chat-media').createSignedUrl(path, 3600);
  if (signedError) throw signedError;
  return { path, name: file.name, mimeType: file.type, size: file.size, url: signed.signedUrl };
}

export async function sendChatMessage(conversationId: string, body: string, attachment?: ChatAttachment | null, replyToId?: string): Promise<ChatMessage> {
  const client = supabase;
  if (!client) throw new Error('Log in to send a message.');
  const user = await verifiedUser();
  if (!body.trim() && !attachment) throw new Error('Write a message or attach a file.');
  const { data, error } = await client.from('care_messages').insert({ conversation_id: conversationId, sender_id: user.id, body: body.trim() || (attachment?.mimeType.startsWith('audio/') ? 'Voice message' : ''), attachment: attachment ? { path: attachment.path, name: attachment.name, mimeType: attachment.mimeType, size: attachment.size } : null, reply_to_id: replyToId ?? null }).select('id,conversation_id,sender_id,body,created_at,attachment,reply_to_id').single();
  if (error) throw error;
  return { id: data.id, conversationId: data.conversation_id, senderId: data.sender_id, body: data.body, createdAt: data.created_at, attachment, replyTo: null };
}

export async function hideChatMessage(messageId: string): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Log in to delete a message.');
  const user = await verifiedUser();
  const { error } = await client.from('care_message_hidden').insert({ message_id: messageId, user_id: user.id });
  if (error) throw error;
}

export async function recallChatMessage(messageId: string): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Log in to recall a message.');
  const { data: message, error: readError } = await client.from('care_messages').select('attachment').eq('id', messageId).single();
  if (readError) throw readError;
  const { data: recalled, error } = await client.from('care_messages').update({ body: '', attachment: null, deleted_at: new Date().toISOString() }).eq('id', messageId).select('id').maybeSingle();
  if (error) throw error;
  if (!recalled) throw new Error('Messages can only be recalled within 10 minutes of sending.');
  const attachment = message.attachment as ChatAttachment | null;
  if (attachment?.path) await client.storage.from('care-chat-media').remove([attachment.path]).catch(() => undefined);
}

export async function markChatRead(conversationId: string) {
  const client = supabase;
  if (!client) return;
  const { error } = await client.rpc('mark_care_conversation_read', { p_conversation_id: conversationId });
  if (error) throw error;
}

