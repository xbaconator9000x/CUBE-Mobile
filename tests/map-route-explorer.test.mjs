import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {inspectVanillaAtlasRawRoute as route} from '../src/map-route-explorer.js';

const ptr=n=>0x08000000+n;
function u32(r,o,n){for(let i=0;i<4;i++)r[o+i]=(n>>>(8*i))&255;}
function warp(r,o,{map=0,bank=0,id=0}={}){
 r.fill(0,o,o+8);r[o+5]=id;r[o+6]=map;r[o+7]=bank;
}
function fixture(){
 const rom=new Uint8Array(0x2000).fill(0xff);
 u32(rom,0x100,ptr(0x140));
 for(let i=0;i<3;i++){
  const h=0x200+i*0x40,l=0x300+i*0x40,e=0x900+i*0x40;
  u32(rom,0x140+i*4,ptr(h));
  u32(rom,h,ptr(l));u32(rom,h+4,ptr(e));
  u32(rom,h+8,0);u32(rom,h+12,0);
  u32(rom,l,2);u32(rom,l+4,2);
  for(const [off,to] of [[8,0x700],[12,0x500+i*0x20],
    [16,0x800],[20,0x820]])u32(rom,l+off,ptr(to));
  rom.fill(0,e,e+20);
  rom[e+1]=i===0?3:1;
  u32(rom,e+8,ptr(0xa00+i*0x40));
 }
 warp(rom,0xa00,{map:1});
 warp(rom,0xa08,{map:2});
 warp(rom,0xa10,{bank:255,map:255,id:255});
 warp(rom,0xa40,{map:2});
 warp(rom,0xa80,{map:0});
 return {rom,atlas:inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[3],family:'RSE'
 })};
}
test('finds deterministic shortest raw route without changing ROM bytes',()=>{
 const {rom,atlas}=fixture(),before=rom.slice();
 const direct=route(rom,atlas,{targetBank:0,targetMap:2});
 assert.equal(direct.status,'raw-reachable');
 assert.equal(direct.hops,1);
 assert.equal(direct.steps[0].sourceOffset,0xa08);
 assert.equal(direct.steps[0].kind,'warp');
 assert.equal(direct.eligibleLinks,4);
 assert.equal(direct.excludedLinks,1);
 const indirect=route(rom,atlas,{
  originBank:0,originMap:1,targetBank:0,targetMap:0
 });
 assert.deepEqual(indirect.steps.map(e=>e.sourceOffset),[0xa40,0xa80]);
 assert.equal(indirect.hops,2);
 assert.equal(indirect.gameplayReachabilityVerified,false);
 assert.equal(indirect.writeAuthorized,false);
 assert.ok(Object.isFrozen(indirect.steps)&&Object.isFrozen(indirect.steps[0]));
 assert.deepEqual(rom,before);
});
test('zero-hop, unreachable and excluded special references are explicit',()=>{
 const {rom}=fixture();
 warp(rom,0xa80,{bank:255,map:255,id:255});
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[3],family:'RSE'
 });
 const self=route(rom,atlas,{targetBank:0,targetMap:1,
  originBank:0,originMap:1});
 assert.equal(self.hops,0);
 const missing=route(rom,atlas,{originBank:0,originMap:1,
  targetBank:0,targetMap:0});
 assert.equal(missing.status,'raw-unreachable');
 assert.equal(missing.hops,null);
 assert.deepEqual(missing.steps,[]);
 assert.equal(missing.excludedLinks,2);
});
test('rejects forged atlases, stale ROM pointers and missing destinations',()=>{
 const {rom,atlas}=fixture();
 assert.throws(()=>route(rom,atlas,{targetBank:0,targetMap:9}),/Target/);
 assert.throws(()=>route(rom,{...atlas,maps:[atlas.maps[1],atlas.maps[0],atlas.maps[2]]},
  {targetBank:0,targetMap:2}),/order/);
 u32(rom,0x140,ptr(0x240));
 assert.throws(()=>route(rom,atlas,{targetBank:0,targetMap:2}),/changed/);
});
test('bounded scan and route display limits fail closed',()=>{
 const {rom,atlas}=fixture();
 for(const opts of [
  {maxMaps:2},{maxLinks:4},{maxHops:0},
  {targetBank:-1,targetMap:0},{targetMap:undefined},
  {originBank:3,originMap:0,targetBank:0,targetMap:2},
  {originBank:0,originMap:1,targetBank:0,targetMap:0,maxHops:1}
 ])assert.throws(()=>route(rom,atlas,{targetBank:0,targetMap:2,...opts}),RangeError);
});
