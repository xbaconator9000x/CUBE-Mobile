import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaAtlasEventOwnership} from '../src/map-event-ownership.js';
const ptr=n=>0x08000000+n;
function word(r,o,n){for(let i=0;i<4;i++)r[o+i]=(n>>>(8*i))&255;}
function fixture(){
 const r=new Uint8Array(0x2000).fill(0xff);
 word(r,0x100,ptr(0x140));word(r,0x104,ptr(0x160));
 word(r,0x140,ptr(0x200));word(r,0x144,ptr(0x240));word(r,0x160,ptr(0x280));
 for(const [i,header,layout,blockmap,group,warps] of [
  [0,0x200,0x300,0x400,0x800,0x900],
  [1,0x240,0x320,0x420,0x840,0x920],
  [2,0x280,0x340,0x440,0x880,0x940]]){
  word(r,header,ptr(layout));word(r,header+4,ptr(group));
  word(r,header+8,0);word(r,header+12,0);
  word(r,layout,2);word(r,layout+4,2);
  for(const [off,target] of [[8,0x500],[12,blockmap],[16,0x600],[20,0x620]])
   word(r,layout+off,ptr(target));
  r.set([0,1,0,0],group);
  word(r,group+8,ptr(warps));
  r[warps]=i;
 }
 return r;
}
const atlas=r=>inspectVanillaMapAtlas(r,{
 address:0x100,bankMapCounts:[2,1],family:'RSE'});
test('independent groups/arrays have no aliases or overlaps and preserve ROM bytes',()=>{
 const rom=fixture(),before=rom.slice();
 const result=auditVanillaAtlasEventOwnership(rom,atlas(rom));
 assert.equal(result.totalMaps,3);
 assert.equal(result.mapsWithEvents,3);
 assert.equal(result.totalReferences,6);
 assert.equal(result.distinctSpans,6);
 assert.equal(result.totalGroups,0);
 assert.equal(result.overlapCount,0);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(rom,before);
});
test('shared events and warp arrays report exact source pointer provenance',()=>{
 const rom=fixture();word(rom,0x244,ptr(0x800));
 const result=auditVanillaAtlasEventOwnership(rom,atlas(rom));
 assert.deepEqual(result.counts,{events:1,objects:0,warps:1,scripts:0,signposts:0});
 assert.equal(result.totalGroups,2);
 assert.equal(result.overlapCount,0);
 assert.deepEqual(result.groups.map(g=>g.referenceCount),[2,2]);
 assert.deepEqual(result.groups[0].references.map(x=>x.sourceOffset),[0x204,0x244]);
 assert.deepEqual(result.groups[1].references.map(x=>x.sourceOffset),[0x808,0x808]);
 assert.ok(Object.isFrozen(result.groups[0].references));
});
test('partial overlap between distinct map warp arrays is flagged, not conflated with exact aliases',()=>{
 const rom=fixture();word(rom,0x848,ptr(0x904));
 const result=auditVanillaAtlasEventOwnership(rom,atlas(rom));
 assert.equal(result.totalGroups,0);
 assert.equal(result.overlapCount,1);
 assert.equal(result.overlaps[0].kind,'warps');
 assert.equal(result.overlaps[0].offset,0x904);
 assert.equal(result.overlaps[0].intersectsOffset,0x900);
});
test('bounded group/overlap output still counts all findings',()=>{
 const rom=fixture();word(rom,0x244,ptr(0x800));
 word(rom,0x284,ptr(0x800));
 const result=auditVanillaAtlasEventOwnership(rom,atlas(rom),{
  maxGroups:1,maxReferences:1});
 assert.equal(result.totalGroups,2);
 assert.equal(result.groups.length,1);
 assert.equal(result.groupsTruncated,true);
 assert.equal(result.groups[0].referenceCount,3);
 assert.equal(result.groups[0].referencesTruncated,true);
});
test('stale bank pointers, invalid structures and malformed caps fail closed',()=>{
 const rom=fixture(),old=atlas(rom);
 word(rom,0x144,ptr(0x200));
 assert.throws(()=>auditVanillaAtlasEventOwnership(rom,old),/changed since inspection/);
 const fresh=fixture(),valid=atlas(fresh);
 for(const options of [{maxGroups:0},{maxReferences:33},{maxConflicts:257},
  {maxGroups:1.2}])assert.throws(
  ()=>auditVanillaAtlasEventOwnership(fresh,valid,options),RangeError);
 assert.throws(()=>auditVanillaAtlasEventOwnership(fresh,{}),TypeError);
 word(fresh,0x808,ptr(0x7ffff));
 assert.throws(()=>auditVanillaAtlasEventOwnership(fresh,valid),RangeError);
});
test('staged reader is respected without mutating underlying ROM',()=>{
 const rom=fixture(),before=rom.slice(),original=atlas(rom);
 const reader={length:rom.length,read:i=>i===0x244?0x00:rom[i]};
 const result=auditVanillaAtlasEventOwnership(reader,original);
 assert.equal(result.mapsWithEvents,3);
 assert.equal(result.totalGroups,0);
 assert.deepEqual(rom,before);
});
