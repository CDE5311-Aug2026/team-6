import { createClient } from '@supabase/supabase-js';

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

export async function createCloudAccount(name: string, email: string, password: string) {
  const { data, error } = await client().auth.signUp({
    email, password,
    options: { data: { display_name: name }, emailRedirectTo: window.location.origin + '/' },
  });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session };
}

export async function loginCloudAccount(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
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

