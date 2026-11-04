import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Print DML for a verified, already-published demo template. This script never
// connects to Supabase, reads credentials, or rewrites customer workspaces.
const pet=JSON.parse(readFileSync(new URL('../fixtures/momo-demo-week.json',import.meta.url),'utf8'));
const observations=pet.workspace.observations;
assert.equal(observations.length,50);
assert.equal(new Set(observations.map(o=>o.image)).size,50);
assert.ok(observations.every(o=>o.synthetic===true&&o.image.startsWith('https://efihvahumvqyaumdqpcy.supabase.co/storage/v1/object/public/pawsona-demo/momo-v2/')));
const json=JSON.stringify(pet);
assert.ok(!json.includes('$momo$'));
assert.match(pet.testData.datasetId,/^[a-z0-9-]+$/);
console.log(`insert into pawsona_private.demo_pet_templates(id,pet,enabled,activated_at)\nvalues ('${pet.testData.datasetId}',$momo$${json}$momo$::jsonb,true,now())\non conflict(id) do nothing;`);
