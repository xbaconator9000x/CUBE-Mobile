import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaAtlasWarpGraph as graph} from '../src/map-warp-graph.js';

const ptr=n=>0x08000000+n;
function u32(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(8*i)&255;}
function warp(r,o,{bank=0,map=0,id=0}={}){
 r.fill(0,o,o+8);r[o+5]=id;r[o+6]=map;r[o+7]=bank;
}
function fixture(){
 const rom=new Uint8Array(0x2000).fill(0xff);
 u32(rom,0x100,ptr(0x140));
 for(let i=0;i<3;i++){
  const h=0x200+i*0x40,l=0x300+i*0x40;
  u32(rom,0x140+i*4,ptr(h));
  u32(rom,h,ptr(l));
  u32(rom,h+4,i===2?0:ptr(0x900+i*0x40));
  u32(rom,h+8,0);u32(rom,h+12,i===0?ptr(0xb00):0);
  u32(rom,l,2);u32(rom,l+4,2);
  for(const [off,to] of [[8,0x700],[12,0x500+i*0x20],
    [16,0x800],[20,0x820]])u32(rom,l+off,ptr(to));
 }
 rom.fill(0,0x900,0x914);rom.fill(0,0x940,0x954);
 rom[0x901]=4;u32(rom,0x908,ptr(0xa00));
 rom[0x941]=1;u32(rom,0x948,ptr(0xa40));
 warp(rom,0xa00,{map:1});
 warp(rom,0xa08,{map:2}); // destination map has no warp records
 warp(rom,0xa10,{bank:255,map:255,id:255});
 warp(rom,0xa18,{map:9});
 warp(rom,0xa40,{map:0});
 u32(rom,0xb00,1);u32(rom,0xb04,ptr(0xc00));
 rom.fill(0,0xc00,0xc0c);u32(rom,0xc00,1);rom[0xc09]=2;
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[3],family:'RSE'
 });
 return {rom,atlas};
}
test('raw graph distinguishes valid links, invalid destination indices and special targets',()=>{
 const {rom,atlas}=fixture(),before=rom.slice();
 const result=graph(rom,atlas);
 assert.equal(result.mapsInspected,3);
 assert.equal(result.linksInspected,6);
 assert.deepEqual(result.counts,{
  resolved:3,special:1,undeclared:1,invalidWarp:1,
  warps:5,connections:1,oneWayPairs:1
 });
 assert.equal(result.reachableByRawLinks,3);
 assert.equal(result.notReachedByRawLinks,0);
 assert.equal(result.isolatedMaps,0);
 assert.deepEqual(result.rows.map(x=>[x.incoming,x.outgoing]),[[1,2],[1,1],[1,0]]);
 assert.deepEqual(result.findings.map(x=>x.status),[
  'invalidWarp','special','undeclared','no-direct-return'
 ]);
 assert.equal(result.findings[0].offset,0xa08);
 assert.equal(result.findings[3].source,'0,0');
 assert.equal(result.findings[3].target,'0,2');
 assert.equal(result.gameplayReachabilityVerified,false);
 assert.equal(result.writeAuthorized,false);
 assert.ok(Object.isFrozen(result.rows)&&Object.isFrozen(result.counts));
 assert.deepEqual(rom,before);
});
test('directed reachability is only raw graph reachability, not player traversal',()=>{
 const {rom}=fixture();
 u32(rom,0x20c,0); // no map 0 connection header
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[3],family:'RSE'
 });
 const result=graph(rom,atlas,{originBank:0,originMap:1});
 assert.equal(result.reachableByRawLinks,2);
 assert.equal(result.notReachedByRawLinks,1);
 assert.equal(result.isolatedMaps,1);
 assert.equal(result.rows[2].reachableByRawLinks,false);
 assert.equal(result.counts.oneWayPairs,0);
});
test('truncated display never truncates aggregate coverage',()=>{
 const {rom,atlas}=fixture();
 const result=graph(rom,atlas,{maxRows:1,maxFindings:1});
 assert.equal(result.rows.length,1);
 assert.equal(result.rowsTruncated,true);
 assert.equal(result.totalFindings,4);
 assert.equal(result.findingsTruncated,true);
 assert.equal(result.linksInspected,6);
});
test('canonical provenance rejects forged or stale atlases and pointers',()=>{
 const {rom,atlas}=fixture();
 const forged={...atlas,maps:[{...atlas.maps[0],mapHeaderOffset:0x240},...atlas.maps.slice(1)]};
 assert.throws(()=>graph(rom,forged),/changed/);
 const swapped={...atlas,maps:[atlas.maps[1],atlas.maps[0],atlas.maps[2]]};
 assert.throws(()=>graph(rom,swapped),/order/);
 u32(rom,0x140,ptr(0x240));
 assert.throws(()=>graph(rom,atlas),/changed/);
});
test('limits, invalid origin and malformed accessor fail closed',()=>{
 const {rom,atlas}=fixture();
 for(const options of [{maxMaps:2},{maxLinks:5},{maxRows:0},
   {maxFindings:0},{originBank:0,originMap:3},{originBank:-1}])
  assert.throws(()=>graph(rom,atlas,options),RangeError);
 const accessor={length:rom.length,read:i=>i===0xa00?999:rom[i]};
 assert.throws(()=>graph(accessor,atlas),/invalid/i);
 assert.throws(()=>graph(rom,{}),TypeError);
});
