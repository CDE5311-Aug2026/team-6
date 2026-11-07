import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/profileRecords.ts', import.meta.url),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const { observationBelongsToAccount, observationCompletedByAccount } = await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const pet={sharedGroupId:'group', sharedOwnerAccountId:'owner',workspace:{careTasks:[]}};
const record={id:'record',authorId:'owner',savedAt:'2026-11-07T01:00:00Z'};
test('manually authored public and private notes appear without a linked care task',()=>{
 assert.equal(observationCompletedByAccount(pet,record,'owner'),true);
 assert.equal(observationCompletedByAccount(pet,{...record,privateRecord:true},'owner'),true);
 assert.equal(observationCompletedByAccount(pet,record,'other'),false);
});
test('ownership and completion remain distinct for shared and simulated records',()=>{
 assert.equal(observationBelongsToAccount(pet,{...record,authorId:'other'},'owner'),false);
 const donePet={...pet,workspace:{careTasks:[{sourceObservationId:'record',status:'done',completedBy:'helper'}]}};
 assert.equal(observationCompletedByAccount(donePet,{...record,synthetic:true},'helper'),true);
 assert.equal(observationCompletedByAccount(donePet,{...record,synthetic:true},'owner'),false);
});
