import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVanillaBankMapCounts,inspectVanillaMapAtlas,lookupVanillaMapAtlasTarget,probeVanillaMapBankTables,auditVanillaAtlasPointerAliases} from '../src/map-atlas.js';
const ptr=n=>0x08000000+n;
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(i*8)&255;}
function fixture(){
 const r=new Uint8Array(0x1000).fill(0xff);
 d(r,0x100,ptr(0x140));d(r,0x104,ptr(0x160));
 d(r,0x140,ptr(0x200));d(r,0x144,ptr(0x240));
 d(r,0x160,ptr(0x280));
 for(const [header,layout,blockmap] of [[0x200,0x300,0x400],[0x240,0x320,0x420],[0x280,0x340,0x440]]){
  d(r,header,ptr(layout));d(r,header+4,0);d(r,header+8,0);d(r,header+12,0);
  d(r,layout,2);d(r,layout+4,2);
  for(const [off,target] of [[8,0x500],[12,blockmap],[16,0x600],[20,0x620]])
   d(r,layout+off,ptr(target));
 }
 return r;
}
test('strict decimal bank counts and invalid input',()=>{
 assert.deepEqual(parseVanillaBankMapCounts('2, 1'),[2,1]);
 for(const s of ['','0','1,0','1,,2','0x10','1;2','1.5','-1','1025','1,'.repeat(260)+'1'])
  assert.throws(()=>parseVanillaBankMapCounts(s));
});
test('catalog resolves explicitly declared vanilla banks, offsets and targets',()=>{
 const rom=fixture(),original=rom.slice();
 const atlas=inspectVanillaMapAtlas(rom,{address:0x100,bankMapCounts:[2,1],family:'RSE'});
 assert.equal(atlas.mapCount,3);assert.equal(atlas.bankCount,2);
 assert.deepEqual(atlas.maps.map(x=>x.mapHeaderOffset),[0x200,0x240,0x280]);
 assert.equal(lookupVanillaMapAtlasTarget(atlas,0,1).blockmapOffset,0x420);
 assert.equal(lookupVanillaMapAtlasTarget(atlas,1,0).width,2);
 assert.equal(lookupVanillaMapAtlasTarget(atlas,1,1),null);
 assert.equal(lookupVanillaMapAtlasTarget(atlas,2,0),null);
 assert.equal(atlas.layoutAuthenticated,false);
 assert.ok(Object.isFrozen(atlas.maps)&&Object.isFrozen(atlas.maps[0]));
 assert.deepEqual(rom,original);
});
test('staged bytes change atlas readout without modifying source ROM',()=>{
 const r=fixture(),reader={length:r.length,read:i=>i===0x144?0xff:r[i]};
 assert.throws(()=>inspectVanillaMapAtlas(reader,{address:0x100,bankMapCounts:[2,1],family:'RSE'}));
 assert.equal(r[0x144],0x40);
});
test('invalid map counts, overlapping arrays and malformed pointers fail closed',()=>{
 const r=fixture();
 for(const counts of [[0,1],[1025],[1.5],[1,1,1,1],[],Array(257).fill(1)])
  assert.throws(()=>inspectVanillaMapAtlas(r,{address:0x100,bankMapCounts:counts,family:'RSE'}));
 assert.throws(()=>inspectVanillaMapAtlas(r,{address:0x100,bankMapCounts:[2,1],family:'RSE',maxMaps:2}),/limit/);
 const a=fixture();d(a,0x104,ptr(0x140));
 assert.throws(()=>inspectVanillaMapAtlas(a,{address:0x100,bankMapCounts:[2,1],family:'RSE'}),/overlap/);
 const b=fixture();d(b,0x160,ptr(0x100));
 assert.throws(()=>inspectVanillaMapAtlas(b,{address:0x100,bankMapCounts:[2,1],family:'RSE'}));
});

test('bounded vanilla pointer-table probe finds structural candidate without ROM mutation',()=>{
 const rom=fixture(),before=rom.slice();
 const result=probeVanillaMapBankTables(rom,{
  start:0xf0,bytes:0x30,bankMapCounts:[2,1],family:'RSE'
 });
 assert.ok(result.candidates.some(c=>c.address===0x100));
 assert.ok(result.checkedOffsets<=12);
 assert.equal(result.layoutAuthenticated,false);
 assert.ok(Object.isFrozen(result.candidates));
 assert.deepEqual(rom,before);
 const staged={length:rom.length,read:i=>i===0x100?0xff:rom[i]};
 const changed=probeVanillaMapBankTables(staged,{
  start:0x100,bytes:8,bankMapCounts:[2,1],family:'RSE'
 });
 assert.equal(changed.matches,0);
});
test('bank-table probe rejects oversized, ambiguous and unaligned requests',()=>{
 const rom=fixture();
 for(const options of [
  {start:1,bytes:64,bankMapCounts:[2,1],family:'RSE'},
  {start:0,bytes:4097,bankMapCounts:[2,1],family:'RSE'},
  {start:0,bytes:4,bankMapCounts:[2,1],family:'RSE'},
  {start:0,bytes:64,bankMapCounts:[129],family:'RSE'},
  {start:0,bytes:64,bankMapCounts:[2,1],family:'CUBE'},
  {start:0,bytes:64,bankMapCounts:[2,1],family:'RSE',maxCandidates:0}
 ])assert.throws(()=>probeVanillaMapBankTables(rom,options),RangeError);
});

test('shared vanilla layouts and blockmaps expose exact pointer-source ownership hints',()=>{
 const rom=fixture(),before=rom.slice();
 const independent=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[2,1],family:'RSE'
 });
 assert.equal(auditVanillaAtlasPointerAliases(independent).totalGroups,0);
 d(rom,0x240,ptr(0x300));
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[2,1],family:'RSE'
 });
 const result=auditVanillaAtlasPointerAliases(atlas);
 assert.deepEqual(result.counts,{header:0,layout:1,blockmap:1});
 assert.equal(result.totalGroups,2);
 assert.equal(result.groups[0].offset,0x300);
 assert.deepEqual(result.groups[0].references.map(x=>x.sourceOffset),[0x200,0x240]);
 assert.equal(result.groups[1].offset,0x400);
 assert.deepEqual(result.groups[1].references.map(x=>x.sourceOffset),[0x30c,0x30c]);
 assert.equal(result.ownershipAuthenticated,false);
 assert.ok(Object.isFrozen(result.groups)&&Object.isFrozen(result.groups[0].references));
 assert.deepEqual(rom.slice(0,0x240),before.slice(0,0x240));
});
test('alias groups are bounded, include shared headers and reject invalid catalogs',()=>{
 const rom=fixture();d(rom,0x144,ptr(0x200));
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[2,1],family:'RSE'
 });
 const result=auditVanillaAtlasPointerAliases(atlas,{maxGroups:1,maxReferences:1});
 assert.deepEqual(result.counts,{header:1,layout:1,blockmap:1});
 assert.equal(result.totalGroups,3);
 assert.equal(result.groups.length,1);
 assert.equal(result.groups[0].kind,'header');
 assert.equal(result.groups[0].referenceCount,2);
 assert.equal(result.groups[0].referencesTruncated,true);
 assert.equal(result.truncated,true);
 for(const options of [{maxGroups:0},{maxGroups:257},{maxReferences:0},
  {maxReferences:33},{maxGroups:1.5}])
  assert.throws(()=>auditVanillaAtlasPointerAliases(atlas,options),RangeError);
 assert.throws(()=>auditVanillaAtlasPointerAliases({}),TypeError);
});
