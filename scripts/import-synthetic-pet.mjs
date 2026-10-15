import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import assert from 'node:assert/strict';

// Explicit operator command, never run automatically by app startup or deployment.
const [username, photoPath] = process.argv.slice(2);
if (!username || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) throw new Error('Usage: node scripts/import-synthetic-pet.mjs <username> [photo-path]');
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const password = await prompt.question('Password (not saved; disable terminal echo before entering): ');
prompt.close();
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authError } = await db.auth.signInWithPassword({ email: username.toLowerCase() + '@users.pawsona.invalid', password });
if (authError || !auth.user) throw new Error('Could not sign in to the specified Pawsona account.');
try {
  const { data: row, error } = await db.from('personal_workspaces').select('payload,revision').eq('user_id', auth.user.id).single();
  assert.ifError(error);
  const payload = structuredClone(row.payload);
  const account = payload.accounts.find(account => account.id === auth.user.id);
  assert.ok(account && Array.isArray(account.pets), 'The account workspace is not ready. Log in to Pawsona first.');
  const pet = JSON.parse(readFileSync(new URL('../fixtures/golden-retriever-week.json', import.meta.url), 'utf8'));
  if (account.pets.some(existing => existing.id === pet.id || existing.testData?.datasetId === pet.testData.datasetId)) {
    console.log('Dataset already exists. No records were changed.');
  } else {
    if (photoPath) {
      const bytes = readFileSync(photoPath);
      assert.ok(bytes.length <= 10 * 1024 * 1024 && bytes[0] === 255 && bytes[1] === 216, 'Use a JPEG under 10 MB.');
      const path = auth.user.id + '/' + createHash('sha256').update(bytes).digest('hex');
      const upload = await db.storage.from('pawsona-media').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error;
      const download = await db.storage.from('pawsona-media').download(path);
      assert.ifError(download.error);
      assert.equal(createHash('sha256').update(Buffer.from(await download.data.arrayBuffer())).digest('hex'), createHash('sha256').update(bytes).digest('hex'));
      pet.avatar = 'pawsona-media://' + path;
    }
    const originalPets = structuredClone(account.pets);
    for (const collection of ['observations', 'lifeEvents', 'contexts']) for (const record of pet.workspace[collection]) {
      record.authorId = auth.user.id; record.authorName = '测试照护者';
    }
    pet.workspace.askOwnerAccountId = auth.user.id;
    pet.workspace.careMembers = [{ id: auth.user.id, name: account.name, role: 'Primary owner', detail: 'manages the test profile' }];
    account.pets.push(pet); account.activePetId = pet.id;
    assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 1024 * 1024);
    const written = await db.from('personal_workspaces').update({ payload, revision: row.revision + 1 }).eq('user_id', auth.user.id).eq('revision', row.revision).select('revision').maybeSingle();
    assert.ifError(written.error);
    assert.ok(written.data, 'The workspace changed on another device. Refresh and rerun; no workspace was overwritten.');
    const verified = await db.from('personal_workspaces').select('payload,revision').eq('user_id', auth.user.id).single();
    assert.ifError(verified.error);
    const verifiedAccount = verified.data.payload.accounts.find(entry => entry.id === auth.user.id);
    assert.deepEqual(verifiedAccount.pets.filter(entry => entry.id !== pet.id), originalPets);
    const saved = verifiedAccount.pets.find(entry => entry.id === pet.id);
    assert.equal(saved.workspace.observations.length, 45);
    assert.equal(saved.testData.dailySummaries.length, 7);
    console.log(JSON.stringify({ result: 'saved-and-read-back', pet: saved.name, petId: saved.id, days: 7, observations: 45, lifeEvents: 2, existingPetsPreserved: originalPets.length, photoStoredPrivately: Boolean(saved.avatar), revision: verified.data.revision }));
  }
} finally {
  await db.auth.signOut();
}
