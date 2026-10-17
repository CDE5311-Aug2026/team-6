import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/cloudMediaReferences.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { stableReferenceForBlob } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

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
