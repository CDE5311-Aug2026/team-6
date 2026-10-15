import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import assert from 'node:assert/strict';
const username = process.argv[2];
if (!username || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) throw new Error('Specify the target username.');
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const password = await prompt.question('Password (not saved; terminal echo should be off): '); prompt.close();
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error } = await db.auth.signInWithPassword({ email: username.toLowerCase() + '@users.pawsona.invalid', password });
if (error || !auth.user) throw new Error('Could not sign in.');
try {
  const read = await db.from('personal_workspaces').select('payload,revision').eq('user_id', auth.user.id).single(); assert.ifError(read.error);
  const payload = structuredClone(read.data.payload);
  const account = payload.accounts.find(a => a.id === auth.user.id);
  const english = JSON.parse(readFileSync(new URL('../fixtures/golden-retriever-week.json', import.meta.url), 'utf8'));
  const pet = account?.pets.find(p => p.id === english.id); assert.ok(pet, 'Synthetic pet not found.');
  const oldPet = structuredClone(pet);
  // Replace only generated strings; retain all numeric values, paths, IDs, and account data.
  function englishStrings(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' && target[key] !== undefined) {
        if (key !== 'avatar' && key !== 'authorId' && key !== 'askOwnerAccountId') target[key] = value;
      } else if (Array.isArray(value) && Array.isArray(target[key])) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] === 'string') target[key][i] = value[i];
          else if (value[i] && typeof value[i] === 'object') {
            const dest = value[i].id ? target[key].find(x => x.id === value[i].id) : value[i].date ? target[key].find(x => x.date === value[i].date) : target[key][i];
            if (dest) englishStrings(dest, value[i]);
          }
        }
      } else if (value && typeof value === 'object' && target[key]) englishStrings(target[key], value);
    }
  }
  englishStrings(pet, english);
  const numeric = value => typeof value === 'string' ? '[string]' : typeof value === 'number' || value === null ? value : Array.isArray(value) ? value.map(numeric) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([,v]) => typeof v !== 'string').map(([k,v]) => [k,numeric(v)])) : value;
  assert.deepEqual(numeric(pet), numeric(oldPet)); assert.equal(pet.avatar, oldPet.avatar);
  assert.deepEqual(pet.workspace.observations.map(o => [o.id, o.savedAt, o.metrics]), oldPet.workspace.observations.map(o => [o.id, o.savedAt, o.metrics]));
  assert.ok(!/[\u3400-\u9fff]/u.test(JSON.stringify({ name: pet.name, testData: pet.testData, observations: pet.workspace.observations, events: pet.workspace.lifeEvents, groupName: pet.workspace.groupName })));
  const result = await db.from('personal_workspaces').update({ payload, revision: read.data.revision + 1 }).eq('user_id', auth.user.id).eq('revision', read.data.revision).select('revision').maybeSingle(); assert.ifError(result.error); assert.ok(result.data, 'Workspace changed; refresh and retry.');
  const verified = await db.from('personal_workspaces').select('payload').eq('user_id', auth.user.id).single(); assert.ifError(verified.error);
  assert.deepEqual(verified.data.payload, payload);
  console.log('PASS: generated Sunny content is English; dates, metrics, avatar and all other pets are preserved.');
} finally { await db.auth.signOut({ scope: 'local' }); }
