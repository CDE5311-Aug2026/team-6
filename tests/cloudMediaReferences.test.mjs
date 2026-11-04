import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/cloudMediaReferences.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { stableReferenceForBlob, isUnavailableMediaError, unavailableMediaPlaceholder } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('maps a known object URL back to its stable Storage reference', () => {
  const url = 'blob:http://localhost/session-image';
  const stable = 'pawsona-media://owner/hash';
  assert.equal(stableReferenceForBlob(url, new Map([[url, stable]])), stable);
});

test('rejects an unmapped object URL instead of replacing it with an empty string', () => {
  assert.throws(
    () => stableReferenceForBlob('blob:http://localhost/stale-image', new Map()),
    /image is no longer available to save/i,
  );
});

test('unavailable media degrades without concealing authentication or server failures', () => {
  assert.equal(isUnavailableMediaError({statusCode:'404',message:'Object not found'}),true);
  assert.equal(isUnavailableMediaError({statusCode:403}),true);
  assert.equal(isUnavailableMediaError({statusCode:401,message:'Invalid JWT'}),false);
  assert.equal(isUnavailableMediaError({statusCode:500,message:'Internal error'}),false);
});
test('distinct fallback images round trip to their original media references', () => {
  const a='pawsona-media://member-a/avatar', b='pawsona-media://member-b/avatar';
  const pa=unavailableMediaPlaceholder(a),pb=unavailableMediaPlaceholder(b);
  assert.notEqual(pa,pb);
  const encoded=new Map([[pa,a],[pb,b]]);
  assert.equal(stableReferenceForBlob(pa,encoded),a);
  assert.equal(stableReferenceForBlob(pb,encoded),b);
});

test('distinguishes failed Storage media from a genuine text-only moment or normal SVG', async () => {
  const { isUnavailableMedia } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
  assert.equal(isUnavailableMedia(unavailableMediaPlaceholder('pawsona-media://owner/photo')), true);
  assert.equal(isUnavailableMedia(''), false);
  assert.equal(isUnavailableMedia('https://example.com/photo.png'), false);
  assert.equal(isUnavailableMedia('data:image/svg+xml,<svg/>'), false);
});

test('a denied download retries on the next sync and preserves the original upload reference', async () => {
  let downloads = 0;
  globalThis.__pawsonaMediaTest = {
    supabase: { storage: { from: () => ({ download: async () => ++downloads === 1
      ? { data: null, error: { statusCode: '404', message: 'Object not found' } }
      : { data: new Blob(['test-image'], { type: 'image/jpeg' }), error: null } }) } },
    verifiedUser: async () => ({ id: 'qa' }),
  };
  const helperUrl = 'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64');
  const mediaSource = readFileSync(new URL('../src/cloudMedia.ts', import.meta.url), 'utf8')
    .replace(/^import .* from '\.\/cloud';$/m, 'const { supabase, verifiedUser } = globalThis.__pawsonaMediaTest;')
    .replace(/^import (.*) from '\.\/cloudMediaReferences';$/m, `const $1 = await import('${helperUrl}');`);
  const js = ts.transpileModule(mediaSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const { CloudMedia } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const media = new CloudMedia('qa');
  try {
    const stable = 'pawsona-media://caregiver/photo';
    const first = await media.decode({ image: stable });
    assert.match(first.image, /^data:image\/svg\+xml/);
    assert.deepEqual(await media.encode(first), { image: stable });
    const recovered = await media.decode({ image: stable });
    assert.equal(downloads, 2);
    assert.match(recovered.image, /^blob:/);
    assert.deepEqual(await media.encode(recovered), { image: stable });
    await media.decode({ image: stable });
    assert.equal(downloads, 2, 'successful downloads remain cached');
  } finally { media.dispose(); delete globalThis.__pawsonaMediaTest; }
});
