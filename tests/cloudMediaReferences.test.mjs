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
