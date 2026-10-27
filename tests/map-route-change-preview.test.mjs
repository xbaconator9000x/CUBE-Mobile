import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {previewVanillaWarpRecordChange} from '../src/map-warp-edit-preview.js';
import {compareVanillaReviewedRawRoute as compare} from '../src/map-route-change-preview.js';

const ptr=n=>0x08000000+n;
function u32(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(8*i)&255;}
function warp(r,o,map){r.fill(0,o,o+8);r[o+6]=map;}
function fixture(){
 const rom=new Uint8Array(0x2000).fill(0xff);
 u32(rom,0x100,ptr(0x140));
 for(let i=0;i<3;i++){
  const h=0x200+i*0x40,l=0x300+i*0x40,e=0x900+i*0x40;
  u32(rom,0x140+i*4,ptr(h));u32(rom,h,ptr(l));
  u32(rom,h+4,ptr(e));u32(rom,h+8,0);u32(rom,h+12,0);
  u32(rom,l,2);u32(rom,l+4,2);
  for(const [off,to] of [[8,0x700],[12,0x500+i*0x20],
   [16,0x800],[20,0x820]])u32(rom,l+off,ptr(to));
  rom.fill(0,e,e+20);rom[e+1]=i===0?2:1;
  u32(rom,e+8,ptr(0xa00+i*0x40));
 }
 warp(rom,0xa00,1);warp(rom,0xa08,2);
 warp(rom,0xa40,2);warp(rom,0xa80,0);
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[3],family:'RSE'
 });
 return {rom,atlas};
}
const opts={originBank:0,originMap:0,targetBank:0,targetMap:2};
test('typed warp overlay changes shortest raw route without changing ROM',()=>{
 const {rom,atlas}=fixture(),original=rom.slice();
 const p=previewVanillaWarpRecordChange(rom,{
  address:0x200,family:'RSE',warpIndex:1,changes:{targetMap:0}
 });
 const result=compare(rom,atlas,[p],opts);
 assert.equal(result.before.hops,1);
 assert.equal(result.after.hops,2);
 assert.deepEqual(result.after.steps.map(s=>s.sourceOffset),[0xa00,0xa40]);
 assert.equal(result.routeChanged,true);
 assert.equal(result.typedPreviewRoundtripPassed,true);
 assert.equal(result.transactionCommitted,false);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(rom,original);
});
test('unchanged warp preview leaves raw route identical',()=>{
 const {rom,atlas}=fixture();
 const p=previewVanillaWarpRecordChange(rom,{
  address:0x200,family:'RSE',warpIndex:1,changes:{targetMap:2}
 });
 const result=compare(rom,atlas,[p],opts);
 assert.equal(result.routeChanged,false);
 assert.equal(result.changedBytes,0);
});
test('stale preview and non-warp changes fail closed',()=>{
 const {rom,atlas}=fixture();
 const p=previewVanillaWarpRecordChange(rom,{
  address:0x200,family:'RSE',warpIndex:1,changes:{targetMap:0}
 });
 rom[0xa0e]=7;
 assert.throws(()=>compare(rom,atlas,[p],opts),/changed/);
 const {rom:fresh,atlas:current}=fixture();
 const cell={readOnly:true,previewOnly:true,writeAuthorized:false,
  layoutAuthenticated:false,byteOffset:0x500,
  before:{bytes:[255,255]},after:{bytes:[0,0]}};
 assert.throws(()=>compare(fresh,current,[cell],opts),/warp-only/);
 assert.throws(()=>compare(fresh,current,[],opts),RangeError);
 assert.throws(()=>compare(fresh,current,[p],{...opts,maxChanges:0}),RangeError);
});
