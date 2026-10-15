import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../supabase/functions/_shared/username.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { normalizeUsername, usernameEmail } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('usernames normalize whitespace and case to one identity', () => {
  assert.equal(normalizeUsername('  Luna_123  '), 'luna_123');
  assert.equal(usernameEmail('LUNA_123'), usernameEmail('luna_123'));
  assert.equal(usernameEmail('luna_123'), 'luna_123@users.pawsona.invalid');
});
test('rejects emails, punctuation, unicode, and invalid lengths', () => {
  for (const value of ['', 'ab', 'x'.repeat(25), 'someone@example.com', 'a.b', 'a-b', '猫咪', 'a b', '<script>']) {
    assert.throws(() => normalizeUsername(value), /3–24/);
  }
});
