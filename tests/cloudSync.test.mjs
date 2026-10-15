import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/cloudSync.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { CloudSync } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('serializes writes and preserves the newest edit during an in-flight save', async () => {
  const calls = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const sync = new CloudSync(3, { value: 0 }, async (payload, revision) => {
    calls.push({ payload, revision });
    if (calls.length === 1) await gate;
    return revision + 1;
  }, () => {});
  sync.enqueue({ value: 1 });
  sync.enqueue({ value: 2 });
  sync.enqueue({ value: 3 });
  release();
  await sync.drain();
  assert.deepEqual(calls, [{ payload: { value: 1 }, revision: 3 }, { payload: { value: 3 }, revision: 4 }]);
  assert.equal(sync.dirty, false);
});

test('failed saves keep edits until an explicit retry succeeds', async () => {
  let fail = true;
  const seen = [];
  const states = [];
  const sync = new CloudSync(1, { value: 0 }, async (payload, revision) => {
    if (fail) throw new Error('offline');
    seen.push(payload); return revision + 1;
  }, (state) => states.push(state));
  sync.enqueue({ value: 1 });
  await assert.rejects(sync.drain(), /offline/);
  sync.enqueue({ value: 2 });
  assert.equal(sync.dirty, true);
  fail = false;
  await sync.retry();
  assert.deepEqual(seen, [{ value: 2 }]);
  assert.equal(sync.dirty, false);
  assert.ok(states.includes('error'));
  assert.equal(states.at(-1), 'saved');
});

test('does not rewrite the loaded snapshot or duplicate the same payload', async () => {
  let writes = 0;
  const sync = new CloudSync(8, { value: 0 }, async (_, revision) => { writes++; return revision + 1; }, () => {});
  sync.enqueue({ value: 0 });
  await sync.drain();
  assert.equal(writes, 0);
  sync.enqueue({ value: 1 }); await sync.drain();
  sync.enqueue({ value: 1 }); await sync.drain();
  assert.equal(writes, 1);
});

test('a new workspace starts at the insert revision and stops accepting edits after close', async () => {
  const revisions = [];
  const sync = new CloudSync(null, { value: 0 }, async (_, revision) => { revisions.push(revision); return 1; }, () => {});
  sync.enqueue({ value: 0 }); await sync.drain();
  assert.deepEqual(revisions, [null]);
  sync.stop(); sync.enqueue({ value: 1 });
  assert.deepEqual(revisions, [null]);
});
