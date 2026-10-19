import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { validateChat, buildOpenAIRequest, extractAnswer } from './core.ts';
import { buildHistory } from './history.ts';

const origins = new Set((Deno.env.get('ASK_AI_ALLOWED_ORIGINS') || 'https://pawsona-team6.vercel.app,https://pawsona-team6-preview.vercel.app,https://pawsona-cloud-preview.vercel.app,https://pawsona-username-preview.vercel.app,https://pawsona-accounts-preview.vercel.app,https://pawsona-team-6.vercel.app,https://team-6-main-1-2.vercel.app,http://127.0.0.1:5178,http://127.0.0.1:5179,http://127.0.0.1:5173,http://localhost:5173').split(',').map(origin => origin.trim()));
// Keep the canonical production site available when older secret overrides are present.
origins.add('https://pawsona-team6.vercel.app');
const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.has(origin)) return reply(403, { error: 'This site is not allowed to use Ask AI.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, { error: 'Log in to use Ask AI.' });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return reply(401, { error: 'Your session expired. Please log in again.' });
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return reply(503, { error: 'Ask AI is not configured yet. The project owner needs to add OPENAI_API_KEY in Supabase Edge Function Secrets.' });
  try {
    // Bound the actual bytes even when Content-Length is absent or forged.
    const reader = req.body?.getReader();
    if (!reader) return reply(400, { error: 'Write a message first.' });
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > 4_400_000) { await reader.cancel(); return reply(413, { error: 'Conversation images are too large.' }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let chat;
    try { chat = validateChat(JSON.parse(new TextDecoder().decode(bytes))); }
    catch (error) { return reply(400, { error: error instanceof SyntaxError ? 'Invalid conversation.' : (error as Error).message }); }
    // Explicit ownership predicate: admin client never trusts a client-supplied user ID.
    const { data: row, error } = await admin.from('personal_workspaces').select('payload').eq('user_id', auth.user.id).maybeSingle();
    if (error) return reply(503, { error: 'Could not read your pet profile. Please try again.' });
    const account = row?.payload?.accounts?.find((item: { id: string }) => item.id === auth.user.id);
    const pet = account?.pets?.find((item: { id: string }) => item.id === chat.petId);
    if (!pet || pet.isEmptyProfile) return reply(404, { error: 'Save your pet profile and wait for cloud sync before using Ask AI.' });
    let workspace = pet.workspace ?? {};
    if (pet.sharedGroupId) {
      // A cached personal copy never grants access to a care group's history.
      const { data: member, error: memberError } = await admin.from('care_group_members').select('group_id').eq('group_id', pet.sharedGroupId).eq('user_id', auth.user.id).maybeSingle();
      if (memberError) return reply(503, { error: 'Could not verify care-group access. Please try again.' });
      if (!member) return reply(403, { error: 'You no longer have access to this care group.' });
      const { data: group, error: groupError } = await admin.from('care_groups').select('workspace').eq('id', member.group_id).maybeSingle();
      if (groupError || !group) return reply(503, { error: 'Could not read shared Story records. Please try again.' });
      workspace = group.workspace ?? {};
    }
    const history = chat.includeHistory ? buildHistory(workspace) : '';
    // Reuse the existing atomic, service-role-only hourly quota primitive.
    // Separate prefixes keep AI usage independent from registration counters.
    for (const [bucket, limit] of [['ask:user:' + auth.user.id, 30], ['ask:global', 200]] as const) {
      const { data, error } = await admin.rpc('pawsona_signup_quota', { p_bucket: bucket, p_limit: limit });
      if (error) return reply(503, { error: 'Ask AI usage checks are unavailable. Please try again later.' });
      if (!data) return reply(429, { error: 'The hourly test limit has been reached. Please try again next hour.' });
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildOpenAIRequest(chat.messages, pet, Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini', history)),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) return reply(response.status === 429 ? 429 : 502, { error: response.status === 429
      ? 'The AI service reached its usage or billing limit. Please try later or ask the project owner to check API billing.'
      : 'The AI service could not reply. Please try again or ask the project owner to check the API configuration.' });
    const body = await response.json();
    return reply(200, { answer: extractAnswer(body) });
  } catch (error) {
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
    return reply(timeout ? 504 : 502, { error: timeout ? 'The reply took too long. Your message is still here; please try again.' : 'Could not complete the reply. Please try again.' });
  }
});
