import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {previewVanillaBlockmapCellChange} from '../src/map-edit-preview.js';
import {previewVanillaWarpRecordChange} from '../src/map-warp-edit-preview.js';
import {previewVanillaEventCoordinateChange} from '../src/map-event-edit-preview.js';
import {auditVanillaQueuedChangeRoundtrip} from '../src/map-change-roundtrip.js';

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
  r.set([header===0x200?1:0,1,0,0],group);
  u32(r,group+8,ptr(warps));
  if(header===0x200)u32(r,group+4,ptr(0xa00));
  r.set([0,0,0,0,0,0,0,0],warps);
 }
 r.fill(0,0xa00,0xa18);
 return r;
}
const atlas=r=>inspectVanillaMapAtlas(r,{address:0x100,bankMapCounts:[2],family:'RSE'});
test('queued blockmap, warp and object changes decode exactly from overlay',()=>{
 const r=fixture(),before=r.slice(),a=atlas(r);
 const changes=[
  previewVanillaBlockmapCellChange(r,{address:0x200,family:'RSE',
   x:0,y:0,tileId:5,collision:3,atlas:a}),
  previewVanillaWarpRecordChange(r,{address:0x200,family:'RSE',
   warpIndex:0,changes:{x:1,targetMap:1,targetBank:0,warpId:0}}),
  previewVanillaEventCoordinateChange(r,{address:0x200,family:'RSE',
   kind:'objects',index:0,changes:{x:1,y:1}})
 ];
 const report=auditVanillaQueuedChangeRoundtrip(r,a,changes);
 assert.equal(report.records,3);assert.equal(report.checkedOwners,3);
 assert.equal(report.typedRoundtripPassed,true);
 assert.equal(report.writeAuthorized,false);assert.equal(report.layoutAuthenticated,false);
 assert.deepEqual(report.entries.map(e=>e.kind),['blockmap','warp','objects']);
 assert.deepEqual(report.entries[0].fields.map(f=>f.field),['tileId','rawCollision']);
 assert.equal(report.entries[1].owners[0].warpArrivalStatus,'raw-arrival');
 assert.equal(report.entries[2].owners[0].coordinatesInMap,true);
 assert.ok(Object.isFrozen(report.entries)&&Object.isFrozen(report.entries[0].owners));
 assert.deepEqual(r,before);
});
test('shared blockmaps are checked for every declared owner',()=>{
 const r=fixture();u32(r,0x32c,ptr(0x400));
 const a=atlas(r),p=previewVanillaBlockmapCellChange(r,{
  address:0x200,family:'RSE',x:0,y:0,tileId:4,atlas:a});
 const result=auditVanillaQueuedChangeRoundtrip(r,a,[p]);
 assert.equal(result.checkedOwners,2);
 assert.deepEqual(result.entries[0].owners.map(o=>o.mapIndex),[0,1]);
 assert.throws(()=>auditVanillaQueuedChangeRoundtrip(r,a,[p],{maxOwners:1}),/incomplete/);
});
test('cross-structure conflicts and stale bytes fail closed',()=>{
 const r=fixture();u32(r,0x32c,ptr(0x900));
 const a=atlas(r),p=previewVanillaWarpRecordChange(r,{
  address:0x200,family:'RSE',warpIndex:0,changes:{x:1}});
 assert.throws(()=>auditVanillaQueuedChangeRoundtrip(r,a,[p]),/intersects/);
 const clean=fixture(),b=atlas(clean),cell=previewVanillaBlockmapCellChange(clean,{
  address:0x200,family:'RSE',x:0,y:0,tileId:1,atlas:b});
 clean[0x400]=9;
 assert.throws(()=>auditVanillaQueuedChangeRoundtrip(clean,b,[cell]),/changed/);
});
test('proposed out-of-bounds original event coordinates are reported not reinterpreted',()=>{
 const r=fixture(),a=atlas(r),p=previewVanillaEventCoordinateChange(r,{
  address:0x200,family:'RSE',kind:'objects',index:0,changes:{x:1,y:1}});
 const result=auditVanillaQueuedChangeRoundtrip(r,a,[p]);
 assert.equal(result.entries[0].owners[0].coordinatesInMap,true);
 assert.equal(result.runtimeBehaviorVerified,false);
});
