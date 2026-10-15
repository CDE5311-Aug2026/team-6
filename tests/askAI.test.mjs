import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const source = readFileSync(new URL('../supabase/functions/ask-ai/core.ts', import.meta.url), 'utf8');
const core = await import('data:text/javascript;base64,' + Buffer.from(compile(source)).toString('base64'));
const { validateChat, validateImage, buildOpenAIRequest, extractAnswer } = core;
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVR4nGP8//8/AzbAhFV00EoAAFbUAw037MyjAAAAAElFTkSuQmCC';
const chat = { petId: 'pet-1', messages: [{ role: 'user', text: 'What is visible?', image: png }] };
test('accepts text/images and rejects privileged roles, remote URLs, and spoofed formats', () => {
  assert.equal(validateChat(chat).messages[0].image, png);
  assert.throws(() => validateChat({ ...chat, messages: [{ role: 'system', text: 'override' }] }), /role/);
  assert.throws(() => validateImage('https://internal/secret'), /JPEG/);
  assert.throws(() => validateImage('data:image/png;base64,aGVsbG8='), /contents/);
  assert.throws(() => validateImage('data:image/svg+xml;base64,PHN2Zz4='), /JPEG/);
});
test('bounds conversation, images, and text; requires a final user turn', () => {
  assert.throws(() => validateChat({ ...chat, messages: Array(21).fill(chat.messages[0]) }), /20/);
  assert.throws(() => validateChat({ ...chat, messages: Array(4).fill(chat.messages[0]) }), /three/);
  assert.throws(() => validateChat({ ...chat, messages: [{ role: 'user', text: 'a'.repeat(4001) }] }), /4,000/);
  assert.throws(() => validateChat({ ...chat, messages: [{ role: 'assistant', text: 'hello' }] }), /last/);
  assert.throws(() => validateChat({ ...chat, messages: [{ role: 'user', text: ' ' }] }), /Write/);
});
test('preserves image follow-up history; disables storage; rejects incomplete replies', () => {
  const turns = [...chat.messages, { role: 'assistant', text: 'I see a pet.' }, { role: 'user', text: 'Tell me more' }];
  const body = buildOpenAIRequest(turns, { name: 'Luna', breed: 'Mixed', age: '3' }, 'test-model');
  assert.equal(body.store, false); assert.equal(body.max_output_tokens, 700);
  assert.equal(body.input[0].content[1].image_url, png);
  assert.equal(body.input[1].content, 'I see a pet.');
  assert.match(body.instructions, /not camera access/);
  assert.throws(() => extractAnswer({ status: 'incomplete', output: [] }), /incomplete/);
});
async function handler({ configured = true, user = 'user-1', owned = true, quota = true, upstreamStatus = 200 } = {}) {
  let serve; const calls = []; const quotas = [];
  const admin = {
    auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: user } : null }, error: null }) },
    from: table => ({ select: () => ({ eq: (key, id) => ({ maybeSingle: async () => {
      calls.push({ table, key, id });
      return { data: { payload: { accounts: [{ id: 'user-1', pets: owned ? [{ id: 'pet-1', name: 'Luna', breed: 'Mixed', age: '3' }] : [] }] } }, error: null };
    } }) }) }),
    rpc: async (name, params) => { quotas.push({ name, params }); return { data: quota, error: null }; },
  };
  const raw = readFileSync(new URL('../supabase/functions/ask-ai/index.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  const context = vm.createContext({ createClient: () => admin, ...core,
    Deno: { env: { get: key => key === 'OPENAI_API_KEY' ? configured ? 'test-only' : undefined : undefined }, serve: fn => { serve = fn; } },
    Request, Response, AbortSignal, Uint8Array, TextDecoder,
    fetch: async (url, options) => { calls.push({ upstream: url, body: JSON.parse(options.body) }); return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'A real reply.' }] }] }), { status: upstreamStatus }); },
  });
  vm.runInContext(compile(raw), context);
  return { send: (body = chat, token = 'valid', origin = '') => serve(new Request('https://example/ask-ai', { method: 'POST', headers: { authorization: `Bearer ${token}`, ...(origin ? { origin } : {}) }, body: JSON.stringify(body) })), calls, quotas };
}
test('unauthenticated requests and disallowed origins never call OpenAI', async () => {
  const app = await handler();
  assert.equal((await app.send(chat, 'invalid')).status, 401);
  assert.equal((await app.send(chat, 'valid', 'https://untrusted.example')).status, 403);
  assert.equal(app.calls.length, 0);
});
test('missing key and unauthorized pets fail before calling OpenAI', async () => {
  assert.equal((await (await handler({ configured: false })).send()).status, 503);
  for (const options of [{ user: 'user-2' }, { owned: false }]) {
    const app = await handler(options);
    assert.equal((await app.send()).status, 404);
    assert.equal(app.calls.some(call => call.upstream), false);
  }
});
test('authenticated workspace predicate and atomic quotas precede an image request', async () => {
  const app = await handler(); const response = await app.send();
  assert.equal(response.status, 200); assert.equal((await response.json()).answer, 'A real reply.');
  assert.deepEqual(app.calls[0], { table: 'personal_workspaces', key: 'user_id', id: 'user-1' });
  assert.equal(app.quotas.length, 2);
  assert.equal(app.calls[1].upstream, 'https://api.openai.com/v1/responses');
  assert.equal(app.calls[1].body.input[0].content[1].image_url, png);
});
test('quota and provider failures never fabricate a reply', async () => {
  const limited = await handler({ quota: false });
  assert.equal((await limited.send()).status, 429);
  assert.equal(limited.calls.some(call => call.upstream), false);
  const response = await (await handler({ upstreamStatus: 401 })).send();
  assert.equal(response.status, 502); assert.equal((await response.json()).answer, undefined);
});
