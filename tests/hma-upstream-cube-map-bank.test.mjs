import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditHmaMapPointerMultiplicity} from '../src/hma-map-format-ambiguity.js';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';

const fixture=new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url);
test('pinned upstream CUBE Emerald map-bank declaration is parsed without false duplicate errors',async()=>{
 const text=await readFile(fixture,'utf8');
 const report=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{
   romSize:32*1024*1024
 });
 assert.equal(report.declarationCount,1);
 assert.equal(report.declarations[0].address,0x102D520);
 assert.equal(report.declarations[0].addressInBounds,true);
 assert.equal(report.status,'custom-candidate');
 assert.equal(report.multiplicity.ambiguous,false);
 assert.equal(report.multiplicity.counts['map.connections'],1);
 assert.equal(report.hierarchy.sections.layout!==null,true);
 assert.equal(report.hierarchy.sections.events!==null,true);
 assert.equal(report.hierarchy.sections.warps!==null,true);
 assert.equal(report.romAuthenticated,false);
 assert.equal(report.writeAuthorized,false);
});
test('nested same-name connection arrays are valid but same-depth duplicates remain ambiguous',()=>{
 const nested='[banks<map<[connections<[count:: connections<[direction.]1>/count>]1> music.]1>]1>';
 const valid=auditHmaMapPointerMultiplicity(nested);
 assert.equal(valid.ambiguous,false);
 assert.equal(valid.counts['map.connections'],1);
 const repeated='[banks<map<[connections<[count:: connections<[direction.]1>/count>]1> connections<[count::]1> music.]1>]1>';
 const invalid=auditHmaMapPointerMultiplicity(repeated);
 assert.equal(invalid.ambiguous,true);
 assert.deepEqual(invalid.duplicates.map(d=>d.scope+'.'+d.name),['map.connections']);
});
