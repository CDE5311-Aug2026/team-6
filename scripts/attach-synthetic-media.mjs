import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import assert from 'node:assert/strict';

const [username, directory] = process.argv.slice(2);
if (!username || !directory || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) throw new Error('Usage: node scripts/attach-synthetic-media.mjs <username> <image-directory>');
const manifest = JSON.parse(readFileSync(new URL('../fixtures/sunny-activity-media.json', import.meta.url), 'utf8'));
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
const password = await prompt.question('Password (not saved; terminal echo should be off): '); prompt.close();
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error } = await db.auth.signInWithPassword({ email: username.toLowerCase() + '@users.pawsona.invalid', password });
if (error || !auth.user) throw new Error('Could not sign in.');
try {
  const read = await db.from('personal_workspaces').select('payload,revision').eq('user_id', auth.user.id).single(); assert.ifError(read.error);
  const payload = structuredClone(read.data.payload), account = payload.accounts.find(a => a.id === auth.user.id);
  const pet = account?.pets.find(p => p.id === manifest.petId && p.testData?.datasetId === manifest.datasetId); assert.ok(pet, 'Expected synthetic dataset not found.');
  const before = structuredClone(pet.workspace.observations), otherPets = structuredClone(account.pets.filter(p => p.id !== pet.id));
  const storage = db.storage.from('pawsona-media'); const assets = [];
  for (const asset of manifest.assets) {
    const bytes = readFileSync(resolve(directory, asset.file));
    assert.ok(bytes.length < 10 * 1024 * 1024 && bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a', 'Use PNG files under 10 MB.');
    const hash = createHash('sha256').update(bytes).digest('hex'), path = auth.user.id + '/' + hash;
    const upload = await storage.upload(path, bytes, { contentType: 'image/png', upsert: false });
    if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error;
    const download = await storage.download(path); assert.ifError(download.error);
    assert.equal(createHash('sha256').update(Buffer.from(await download.data.arrayBuffer())).digest('hex'), hash);
    assets.push({ ...asset, url: 'pawsona-media://' + path, mimeType: 'image/png' });
  }
  for (const record of pet.workspace.observations) {
    if (!record.synthetic) continue;
    const asset = assets.find(asset => asset.recordKinds.includes(record.observationKind)); if (!asset) continue;
    record.image = asset.url; record.mediaType = asset.mimeType;
    record.mediaProvenance = { kind: manifest.provenance.kind, assetId: asset.id, illustrative: true };
  }
  pet.testData.mediaAssets = assets;
  pet.testData.mediaProvenance = manifest.provenance;
  assert.deepEqual(pet.workspace.observations.map(r => [r.id,r.savedAt,r.note,r.metrics]), before.map(r => [r.id,r.savedAt,r.note,r.metrics]));
  const write = await db.from('personal_workspaces').update({ payload, revision: read.data.revision + 1 }).eq('user_id', auth.user.id).eq('revision', read.data.revision).select('revision').maybeSingle(); assert.ifError(write.error); assert.ok(write.data, 'Workspace changed; refresh before retrying.');
  const check = await db.from('personal_workspaces').select('payload').eq('user_id', auth.user.id).single(); assert.ifError(check.error);
  const checkedAccount = check.data.payload.accounts.find(a => a.id === auth.user.id), checkedPet = checkedAccount.pets.find(p => p.id === pet.id);
  assert.deepEqual(checkedAccount.pets.filter(p => p.id !== pet.id), otherPets);
  assert.equal(checkedPet.workspace.observations.filter(r => r.image.startsWith('pawsona-media://')).length, 45);
  console.log(JSON.stringify({ result: 'verified', assets: assets.length, illustratedRecords: 45, numericDataPreserved: true, otherPetsPreserved: true }));
} finally { await db.auth.signOut({ scope: 'local' }); }
