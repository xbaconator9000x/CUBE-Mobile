import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateParity} from '../scripts/parity-audit.mjs';
const manifest=JSON.parse(readFileSync(new URL('../parity/feature-inventory.json',import.meta.url),'utf8'));
test('pinned upstream feature inventory is reproducible and conservative',()=>{
 const result=evaluateParity(manifest);
 assert.equal(result.total,30);
 assert.equal(result.verified,0);
 assert.equal(result.reached20Percent,false);
 assert.equal(result.partial+result.absent,result.total);
});
test('duplicate IDs and unsubstantiated verified claims fail closed',()=>{
 const copy=structuredClone(manifest);
 copy.features[1].id=copy.features[0].id;
 assert.throws(()=>evaluateParity(copy),/Duplicate/);
 const elevated=structuredClone(manifest);
 elevated.features[0].status='verified';
 assert.throws(()=>evaluateParity(elevated),/mobileUI/);
});
