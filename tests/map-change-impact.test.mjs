import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {previewVanillaBlockmapCellChange} from '../src/map-edit-preview.js';
import {previewVanillaWarpRecordChange} from '../src/map-warp-edit-preview.js';
import {auditVanillaChangeImpact} from '../src/map-change-impact.js';

const ptr=n=>0x08000000+n;
function u32(r,at,n){for(let i=0;i<4;i++)r[at+i]=(n>>>(i*8))&255;}
function fixture(){
 const r=new Uint8Array(0x2000).fill(0xff);
 u32(r,0x100,ptr(0x140));u32(r,0x140,ptr(0x200));u32(r,0x144,ptr(0x240));
 for(const [header,layout,block,group,warps] of [
  [0x200,0x300,0x400,0x800,0x900],
  [0x240,0x320,0x420,0x840,0x920]]){
  u32(r,header,ptr(layout));u32(r,header+4,ptr(group));
  u32(r,header+8,0);u32(r,header+12,0);
  u32(r,layout,2);u32(r,layout+4,2);
  for(const [off,to] of [[8,0x500],[12,block],[16,0x600],[20,0x620]])
   u32(r,layout+off,ptr(to));
  r.set([0,1,0,0],group);u32(r,group+8,ptr(warps));
  r.set([0,0,0,0,0,0,0,0],warps);
 }
 return r;
}
const atlas=r=>inspectVanillaMapAtlas(r,{address:0x100,bankMapCounts:[2],family:'RSE'});
const cell=(r,a)=>previewVanillaBlockmapCellChange(r,{address:a,family:'RSE',
 x:0,y:0,tileId:1,atlas:atlas(r)});
const warp=(r,a)=>previewVanillaWarpRecordChange(r,{address:a,family:'RSE',
 warpIndex:0,changes:{x:1}});
test('queued cell and warp impacts resolve exact owning maps without mutation',()=>{
 const r=fixture(),before=r.slice(),a=atlas(r);
 const result=auditVanillaChangeImpact(r,a,[cell(r,0x200),warp(r,0x240)]);
 assert.equal(result.reviewed,2);assert.equal(result.totalMaps,2);
 assert.equal(result.sharedRecords,0);assert.equal(result.conflictedRecords,0);
 assert.deepEqual(result.entries.map(e=>e.kind),['blockmap','warp']);
 assert.deepEqual(result.entries.map(e=>e.ownerCount),[1,1]);
 assert.deepEqual(result.entries[1].owners[0],{bankIndex:0,mapIndex:1,headerOffset:0x240});
 assert.equal(result.writeAuthorized,false);assert.equal(result.transactionCommitted,false);
 assert.ok(Object.isFrozen(result.entries)&&Object.isFrozen(result.entries[0].owners));
 assert.deepEqual(r,before);
});
test('shared blockmaps and warp arrays are reported as multi-map impacts',()=>{
 const r=fixture();u32(r,0x32c,ptr(0x400));u32(r,0x244,ptr(0x800));
 const a=atlas(r);
 const result=auditVanillaChangeImpact(r,a,[cell(r,0x200),warp(r,0x200)]);
 assert.equal(result.sharedRecords,2);
 assert.deepEqual(result.entries.map(e=>e.ownerCount),[2,2]);
 assert.equal(result.entries[0].owners[1].mapIndex,1);
 const bounded=auditVanillaChangeImpact(r,a,[cell(r,0x200)],{maxOwners:1});
 assert.equal(bounded.entries[0].ownersTruncated,true);
 assert.equal(bounded.entries[0].ownerCount,2);
});
test('cross-map blockmap/warp overlap is an explicit structural conflict',()=>{
 const r=fixture();u32(r,0x32c,ptr(0x900));
 const result=auditVanillaChangeImpact(r,atlas(r),[warp(r,0x200)]);
 assert.equal(result.conflictedRecords,1);
 assert.equal(result.entries[0].structuralConflict,true);
 assert.ok(result.entries[0].conflicts.some(c=>c.kind==='blockmap'));
});
test('stale catalog, spoofed provenance, malformed caps and changed originals fail closed',()=>{
 const r=fixture(),a=atlas(r),p=cell(r,0x200);
 u32(r,0x144,ptr(0x200));
 assert.throws(()=>auditVanillaChangeImpact(r,a,[p]),/Atlas changed/);
 const fresh=fixture(),valid=atlas(fresh),good=cell(fresh,0x200);
 assert.throws(()=>auditVanillaChangeImpact(fresh,valid,[{...good,headerOffset:0x240}]),/provenance/);
 assert.throws(()=>auditVanillaChangeImpact(fresh,valid,[good],{maxOwners:0}),RangeError);
 assert.throws(()=>auditVanillaChangeImpact(fresh,valid,[good],{maxConflicts:65}),RangeError);
 fresh[0x400]=0;
 assert.throws(()=>auditVanillaChangeImpact(fresh,valid,[good]),/changed/);
});
test('staged reader preserves underlying ROM and honors staged record bytes',()=>{
 const r=fixture(),before=r.slice(),a=atlas(r);
 const reader={length:r.length,read:i=>i===0x400?1:r[i]};
 const p=previewVanillaBlockmapCellChange(reader,{address:0x200,family:'RSE',
 x:0,y:0,tileId:2,atlas:a});
 const result=auditVanillaChangeImpact(reader,a,[p]);
 assert.equal(result.entries[0].ownerCount,1);
 assert.deepEqual(r,before);
});
