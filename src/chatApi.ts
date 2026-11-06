import { supabase, verifiedUser } from './cloud';

export type ChatConversation = { id: string; kind: 'group' | 'direct'; groupId: string; updatedAt: string; lastMessageAt: string | null; memberIds: string[]; lastMessage?: ChatMessage; unreadCount: number };
export type ChatMessage = { id: string; conversationId: string; senderId: string; body: string; createdAt: string };

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
    client.from('care_messages').select('id,conversation_id,sender_id,body,created_at').in('conversation_id', ids).order('created_at', { ascending: false }).limit(500),
  ]);
  if (memberError) throw memberError;
  if (messageError) throw messageError;
  const messages = (messageRows ?? []).map(row => ({ id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at }));
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
  const { data, error } = await client.from('care_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []).map(row => ({ id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, body: row.body, createdAt: row.created_at }));
}

export async function sendChatMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const client = supabase;
  if (!client) throw new Error('Log in to send a message.');
  const user = await verifiedUser();
  const { data, error } = await client.from('care_messages').insert({ conversation_id: conversationId, sender_id: user.id, body: body.trim() }).select('id,conversation_id,sender_id,body,created_at').single();
  if (error) throw error;
  return { id: data.id, conversationId: data.conversation_id, senderId: data.sender_id, body: data.body, createdAt: data.created_at };
}

export async function markChatRead(conversationId: string) {
  const client = supabase;
  if (!client) return;
  const { error } = await client.rpc('mark_care_conversation_read', { p_conversation_id: conversationId });
  if (error) throw error;
}
