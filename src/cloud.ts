import { createClient } from '@supabase/supabase-js';
import { normalizeUsername, usernameEmail } from '../supabase/functions/_shared/username';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const supabase = url && key && !url.includes('YOUR_PROJECT_REF')
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
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

export async function createCloudAccount(username: string, password: string) {
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

export async function saveCloudProfile(displayName: string, expectedUserId: string) {
  const user = await verifiedUser();
  if (user.id !== expectedUserId) throw new Error('Your account changed. Reload before saving.');
  const { error } = await client().from('profiles').upsert({ id: user.id, display_name: displayName });
  if (error) throw error;
}

