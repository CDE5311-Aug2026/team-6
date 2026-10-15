import { createClient } from '@supabase/supabase-js';
import { normalizeUsername, usernameEmail } from '../_shared/username.ts';

const origins = new Set(['https://pawsona-team6-preview.vercel.app', 'https://pawsona-cloud-preview.vercel.app', 'http://127.0.0.1:5178']);
// Public project key, not an admin credential. This route intentionally allows
// unauthenticated registration, with a fixed operation and server-side quotas.
const projectPublishableKey = 'sb_publishable_MfofWQ_pJZhFgaQ_WnghEg_2GhsWdhG';
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.has(origin)) return reply(403, { error: 'This site is not allowed.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  const apiKey = req.headers.get('apikey');
  if (!apiKey || (apiKey !== projectPublishableKey && apiKey !== Deno.env.get('SUPABASE_ANON_KEY'))) return reply(401, { error: 'Invalid project key.' });
  try {
    if (Number(req.headers.get('content-length') ?? '0') > 4096) return reply(413, { error: 'Request too large.' });
    const raw = await req.text();
    if (raw.length > 4096) return reply(413, { error: 'Request too large.' });
    const body = JSON.parse(raw);
    if (typeof body.username !== 'string' || typeof body.password !== 'string') return reply(400, { error: 'Enter a username and password.' });
    let username: string;
    try { username = normalizeUsername(body.username); } catch (error) { return reply(400, { error: (error as Error).message }); }
    if (body.password.length < 8 || body.password.length > 128) return reply(400, { error: 'Use a password between 8 and 128 characters.' });
    // Hash a gateway-provided address; never persist raw IPs or passwords.
    const ip = req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? 'unknown';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')));
    const ipHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    for (const [bucket, limit] of [['global', 200], [ipHash, 20]] as const) {
      const { data, error } = await admin.rpc('pawsona_signup_quota', { p_bucket: bucket, p_limit: limit });
      if (error) return reply(503, { error: 'Registration is temporarily unavailable. Please try again later.' });
      if (!data) return reply(429, { error: 'Too many registration attempts. Please try again in an hour.' });
    }
    const { error } = await admin.auth.admin.createUser({
      email: usernameEmail(username),
      password: body.password,
      email_confirm: true,
      user_metadata: { username, display_name: body.username.trim() },
    });
    if (error) {
      if (['email_exists', 'user_already_exists'].includes(error.code ?? '') || /already.*registered|already.*exists/i.test(error.message)) return reply(409, { error: 'That username is already taken.' });
      return reply(400, { error: 'Could not create this account. Try a different username or stronger password.' });
    }
    return reply(201, { ok: true });
  } catch { return reply(400, { error: 'Could not process registration. Please try again.' }); }
});
