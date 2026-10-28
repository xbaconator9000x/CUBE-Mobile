import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateEngineeringWork} from '../scripts/engineering-audit.mjs';
import {evaluateParity} from '../scripts/parity-audit.mjs';

const inventory=JSON.parse(readFileSync(new URL('../parity/feature-inventory.json',import.meta.url)));
const wbs=JSON.parse(readFileSync(new URL('../parity/engineering-wbs.json',import.meta.url)));
const clone=()=>structuredClone(wbs);

test('weighted engineering baseline remains separate from strict verified parity',()=>{
 const result=evaluateEngineeringWork(wbs,inventory);
 const parity=evaluateParity(inventory);
 assert.equal(result.totalRelativeEffortUnits,286);
 assert.equal(result.confidence,'low');
 assert.ok(result.engineeringWorkPercent>0&&result.engineeringWorkPercent<20);
 assert.ok(result.uncertaintyLowPercent<result.engineeringWorkPercent);
 assert.ok(result.uncertaintyHighPercent>result.engineeringWorkPercent);
 assert.equal(result.planningMilestonePercent,50);
 assert.equal(result.planningMilestoneMet,false);
 assert.equal(result.independentAcceptanceVerified,false);
 assert.equal(parity.verified,0);
 assert.equal(parity.total,30);
});

test('rejects missing, duplicated, and falsely evidenced feature work',()=>{
 const missing=clone();missing.families.pop();
 assert.throws(()=>evaluateEngineeringWork(missing,inventory),/30 audited/i);
 const duplicate=clone();duplicate.families[1].id=duplicate.families[0].id;
 assert.throws(()=>evaluateEngineeringWork(duplicate,inventory),/duplicate/i);
 const invented=clone();invented.families.find(f=>f.id==='scripts').completion={low:0,mid:.2,high:.3};
 assert.throws(()=>evaluateEngineeringWork(invented,inventory),/Absent feature/i);
 const wrong=clone();wrong.families[0].upstreamPath='src/HexManiac.Core/fake.cs';
 assert.throws(()=>evaluateEngineeringWork(wrong,inventory),/source\/evidence/i);
});

test('rejects impossible fractions, fabricated evidence, and changed provenance',()=>{
 const bad=clone();bad.sharedWorkstreams[0].completion={low:.4,mid:.2,high:.6};
 assert.throws(()=>evaluateEngineeringWork(bad,inventory),/ordered fractions/i);
 const absent=clone();absent.sharedWorkstreams[0].sourceRefs=['missing'];
 assert.throws(()=>evaluateEngineeringWork(absent,inventory),/shared-workstream evidence/i);
 const unpinned=clone();unpinned.upstreamCommit='0'.repeat(40);
 assert.throws(()=>evaluateEngineeringWork(unpinned,inventory),/provenance/i);
});
