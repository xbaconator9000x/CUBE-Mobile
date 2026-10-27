import test from 'node:test';
import assert from 'node:assert/strict';
import {auditHmaMapPointerMultiplicity} from '../src/hma-map-format-ambiguity.js';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';

const source=format=>[{name:'cube.toml',text:`[[NamedAnchors]]
Name = "data.maps.banks"
Address = 0x100
Format = '''${format}'''`}];

test('unique nested pointer names remain only metadata candidates',()=>{
 const fmt='[banks<map<[layout<[width::]1> events<[warps<[x:]1>]1> music.]1>]1>';
 const audit=auditHmaMapPointerMultiplicity(fmt);
 assert.equal(audit.ambiguous,false);
 assert.equal(audit.counts['banks.map'],1);
 assert.equal(audit.counts['map.layout'],1);
 assert.equal(audit.counts['events.warps'],1);
 assert.equal(inspectHmaMapBankAnchorSources(source(fmt)).status,'custom-candidate');
});
test('duplicate map pointers fail closed rather than silently selecting first',()=>{
 const fmt='[banks<map<[music.]1> map<[weather.]1>]1>';
 const audit=auditHmaMapPointerMultiplicity(fmt);
 assert.deepEqual(audit.duplicates.map(d=>d.scope+'.'+d.name),['banks.map']);
 const report=inspectHmaMapBankAnchorSources(source(fmt));
 assert.equal(report.status,'ambiguous-format');
 assert.equal(report.hierarchy,null);
 assert.equal(report.multiplicity.ambiguous,true);
});
test('duplicate nested event pointer fields are ambiguous',()=>{
 const fmt='[banks<map<[events<[warps<[x:]1> warps<[y:]1>]1> music.]1>]1>';
 const report=inspectHmaMapBankAnchorSources(source(fmt));
 assert.equal(report.status,'ambiguous-format');
 assert.equal(report.multiplicity.duplicates[0].scope,'events');
 assert.equal(report.multiplicity.duplicates[0].name,'warps');
});
test('similar identifier names do not count as duplicate pointer fields',()=>{
 const fmt='[banks<remap<[a.]1> map<[events<[warps<[x:]1> rewarps<[y:]1>]1> music.]1>]1>';
 const audit=auditHmaMapPointerMultiplicity(fmt);
 assert.equal(audit.ambiguous,false);
 assert.equal(audit.counts['banks.map'],1);
 assert.equal(audit.counts['events.warps'],1);
});
test('malformed or oversized nested format audit fails closed',()=>{
 assert.throws(()=>auditHmaMapPointerMultiplicity(null),RangeError);
 assert.throws(()=>auditHmaMapPointerMultiplicity('x'.repeat(8193)),RangeError);
 assert.throws(()=>auditHmaMapPointerMultiplicity('[banks<map<[x.]1]'),RangeError);
});
