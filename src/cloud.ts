import { createClient } from '@supabase/supabase-js';
import { normalizeUsername, usernameEmail } from '../supabase/functions/_shared/username';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const rememberMeKey = 'pawsona-remember-me-v1';

function shouldRememberSession() {
  try { return localStorage.getItem(rememberMeKey) !== 'false'; }
  catch { return true; }
}

const authStorage = {
  async getItem(storageKey: string) {
    try {
      const primary = shouldRememberSession() ? localStorage : sessionStorage;
      const fallback = shouldRememberSession() ? sessionStorage : localStorage;
      const saved = primary.getItem(storageKey);
      if (saved) return saved;
      const previous = fallback.getItem(storageKey);
      if (!previous) return null;
      primary.setItem(storageKey, previous);
      fallback.removeItem(storageKey);
      return previous;
    } catch { return null; }
  },
  async setItem(storageKey: string, value: string) {
    const persistent = shouldRememberSession();
    const primary = persistent ? localStorage : sessionStorage;
    const fallback = persistent ? sessionStorage : localStorage;
    fallback.removeItem(storageKey);
    primary.setItem(storageKey, value);
  },
  async removeItem(storageKey: string) {
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(storageKey);
  },
};

export const supabase = url && key && !url.includes('YOUR_PROJECT_REF')
  ? createClient(url, key, { auth: { persistSession: true, storage: authStorage, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

function client() {
  if (!supabase) throw new Error('Cloud accounts are not configured yet. Continue as guest for now.');
  return supabase;
}

export async function verifiedUser() {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error('Please log in again before accessing cloud data.');
  return data.user;
}

export async function registerCloudAccount(username: string, password: string) {
  const normalized = normalizeUsername(username);
  const { data, error } = await client().functions.invoke('register-username', { body: { username: normalized, password } });
  if (error) {
    const response = 'context' in error ? error.context : null;
    if (response instanceof Response) {
      const body = await response.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw new Error('Could not register. Please try again.');
  }
  if (!data?.ok) throw new Error('Could not create this account.');
}

export async function createCloudAccount(username: string, password: string) {
  const normalized = normalizeUsername(username);
  await registerCloudAccount(normalized, password);
  await loginCloudAccount(normalized, password);
}

export async function loginCloudAccount(username: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email: usernameEmail(username), password });
  if (error) throw new Error(error.code === 'invalid_credentials' ? 'Incorrect username or password.' : error.message);
}

export async function logoutCloudAccount() {
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export type CloudWorkspace<T> = { payload: T; revision: number };

export async function readCloudWorkspace<T>(): Promise<CloudWorkspace<T> | null> {
  const user = await verifiedUser();
  const { data, error } = await client().from('personal_workspaces')
    .select('payload, revision, schema_version').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.schema_version !== 1) throw new Error('This workspace needs a newer version of Pawsona.');
  return { payload: data.payload as T, revision: data.revision };
}

export async function initializeCloudWorkspace<T extends object>(payload: T, expectedUserId: string): Promise<CloudWorkspace<T>> {
  const user = await verifiedUser();
  if (user.id !== expectedUserId) throw new Error('Your signed-in account changed. Reload before saving.');
  // Multiple tabs can open a brand-new account together. Insert only if absent;
  // every tab then reads the same canonical workspace instead of overwriting it.
  const { error } = await client().from('personal_workspaces').upsert(
    { user_id: user.id, payload, revision: 1 },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (error) throw error;
  const result = await readCloudWorkspace<T>();
  if (!result) throw new Error('Could not initialize your cloud workspace. Please try again.');
  return result;
}

export async function writeCloudWorkspace<T extends object>(payload: T, expectedRevision: number | null, expectedUserId: string): Promise<number> {
  const user = await verifiedUser();
  if (user.id !== expectedUserId) throw new Error('Your signed-in account changed. Reload before saving.');
  // An update must match the last revision loaded by this device.
  const query = expectedRevision === null
    ? client().from('personal_workspaces').insert({ user_id: user.id, payload, revision: 1 })
    : client().from('personal_workspaces').update({ payload, revision: expectedRevision + 1 })
      .eq('user_id', user.id).eq('revision', expectedRevision);
  const { data, error } = await query.select('revision').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Your data changed on another device. Reload before saving again.');
  return data.revision;
}

export async function saveCloudProfile(displayName: string, avatarPath: string, expectedUserId: string) {
  const user = await verifiedUser();
  if (user.id !== expectedUserId) throw new Error('Your account changed. Reload before saving.');
  // An empty workspace avatar can happen in older sessions. Omit the column
  // so an unrelated sync cannot erase an avatar already saved in profiles.
  const query = avatarPath
    ? client().from('profiles').upsert({ id: user.id, display_name: displayName, avatar_path: avatarPath })
    : client().from('profiles').update({ display_name: displayName }).eq('id', user.id);
  const { error } = await query;
  if (error) throw error;
}

export type CareAccountSearchResult = { id: string; username: string; displayName: string };
export type CloudCareInvitation = {
  id: string; groupId: string; inviterId: string; inviteeId: string; role: 'Caregiver' | 'Viewer'; status: 'pending'; createdAt: string;
  ownerName: string; inviteeUsername: string; petId: string; petName: string; petBreed: string; petAge: string; petAvatar: string;
  petSpecies: 'Dog' | 'Cat'; groupName: string; workspace: Record<string, unknown>;
};
export type CloudCareGroup = {
  groupId: string; ownerId: string; petId: string; petName: string; petBreed: string; petAge: string; petAvatar: string;
  petSpecies: 'Dog' | 'Cat'; groupName: string; workspace: Record<string, unknown>; role: 'Caregiver' | 'Viewer'; isOwner: boolean;
  members: { id: string; name: string; email: string; avatar: string; role: 'Caregiver' | 'Viewer'; isOwner: boolean }[];
};

function mapCareInvitation(row: Record<string, unknown>): CloudCareInvitation {
  return {
    id: String(row.id), groupId: String(row.group_id), inviterId: String(row.inviter_id), inviteeId: String(row.invitee_id),
    role: row.role === 'Viewer' ? 'Viewer' : 'Caregiver', status: 'pending', createdAt: String(row.created_at),
    ownerName: String(row.owner_name ?? 'Pet caregiver'), inviteeUsername: String(row.invitee_username ?? ''),
    petId: String(row.pet_id), petName: String(row.pet_name), petBreed: String(row.pet_breed ?? ''), petAge: String(row.pet_age ?? ''),
    petAvatar: String(row.pet_avatar ?? ''), petSpecies: row.pet_species === 'Cat' ? 'Cat' : 'Dog', groupName: String(row.group_name ?? 'Care circle'),
    workspace: (row.workspace && typeof row.workspace === 'object' ? row.workspace : {}) as Record<string, unknown>,
  };
}

function mapCareGroup(row: Record<string, unknown>): CloudCareGroup {
  return {
    groupId: String(row.group_id), ownerId: String(row.owner_id), petId: String(row.pet_id), petName: String(row.pet_name),
    petBreed: String(row.pet_breed ?? ''), petAge: String(row.pet_age ?? ''), petAvatar: String(row.pet_avatar ?? ''),
    petSpecies: row.pet_species === 'Cat' ? 'Cat' : 'Dog', groupName: String(row.group_name ?? 'Care circle'),
    workspace: (row.workspace && typeof row.workspace === 'object' ? row.workspace : {}) as Record<string, unknown>,
    role: row.role === 'Viewer' ? 'Viewer' : 'Caregiver', isOwner: row.is_owner === true,
    members: Array.isArray(row.members) ? (row.members as Record<string, unknown>[]).map(member => ({
      id: String(member.id), name: String(member.name ?? 'Caregiver'), email: String(member.email ?? ''),
      avatar: String(member.avatar ?? ''),
      role: member.role === 'Viewer' ? 'Viewer' : 'Caregiver', isOwner: member.is_owner === true,
    })) : [],
  };
}

export async function sendCloudCareInvitation(input: {
  groupId: string; recipientId: string; role: 'Caregiver' | 'Viewer'; petId: string; petName: string; petBreed: string;
  petAge: string; petAvatar: string; petSpecies: 'Dog' | 'Cat'; groupName: string; workspace: Record<string, unknown>;
}) {
  const { data, error } = await client().rpc('send_care_group_invitation', {
    p_group_id: input.groupId, p_recipient_id: input.recipientId, p_role: input.role, p_pet_id: input.petId,
    p_pet_name: input.petName, p_pet_breed: input.petBreed, p_pet_age: input.petAge, p_pet_avatar: input.petAvatar,
    p_pet_species: input.petSpecies, p_group_name: input.groupName, p_workspace: input.workspace,
  });
  if (error) throw new Error(error.message.includes('Could not find the function') ? 'Apply the care-group invitations migration in Supabase, then try again.' : error.message);
  return String(data);
}

export async function listCloudCareInvitations() {
  const { data, error } = await client().rpc('list_my_care_group_invitations');
  if (error) throw new Error(error.message.includes('Could not find the function') ? 'Apply the care-group invitations migration in Supabase, then refresh.' : error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCareInvitation);
}

export async function respondToCloudCareInvitation(invitationId: string, response: 'accepted' | 'declined') {
  const { data, error } = await client().rpc('respond_to_care_group_invitation', { p_invitation_id: invitationId, p_response: response });
  if (error) throw new Error(error.message);
  return data && typeof data === 'object' && 'group_id' in data ? mapCareGroup({ ...(data as Record<string, unknown>), role: (data as Record<string, unknown>).role, is_owner: false }) : null;
}

export async function cancelCloudCareInvitation(invitationId: string) {
  const { error } = await client().rpc('cancel_care_group_invitation', { p_invitation_id: invitationId });
  if (error) throw new Error(error.message);
}

export async function listCloudCareGroups() {
  const { data, error } = await client().rpc('list_my_care_groups');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCareGroup);
}

export async function saveCloudCareGroup(groupId: string, pet: { name: string; breed: string; age: string; avatar: string; species: 'Dog' | 'Cat' }, groupName: string, workspace: Record<string, unknown>) {
  const { error } = await client().rpc('save_care_group_workspace', {
    p_group_id: groupId, p_workspace: workspace, p_group_name: groupName, p_pet_name: pet.name,
    p_pet_breed: pet.breed, p_pet_age: pet.age, p_pet_avatar: pet.avatar, p_pet_species: pet.species,
  });
  if (error) throw new Error(error.message);
}

export async function removeCloudCareMember(groupId: string, memberId: string) {
  const { error } = await client().rpc('remove_care_group_member', { p_group_id: groupId, p_member_id: memberId });
  if (error) throw new Error(error.message);
}

export async function updateCloudCareMember(groupId: string, memberId: string, role: 'Caregiver' | 'Viewer') {
  const { error } = await client().rpc('update_care_group_member', { p_group_id: groupId, p_member_id: memberId, p_role: role });
  if (error) throw new Error(error.message);
}

export async function searchCareAccounts(query: string): Promise<CareAccountSearchResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];
  const { data, error } = await client().rpc('search_pawsona_accounts', { p_query: normalizedQuery });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Account search needs the latest database migration. Apply the account directory migration, then try again.');
    }
    throw new Error('Could not search registered accounts. Please try again.');
  }
  return (data ?? []).map((row: { id: string; username: string; display_name: string }) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
  }));
}

