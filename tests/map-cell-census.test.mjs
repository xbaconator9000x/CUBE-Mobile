import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVanillaMapAtlas} from '../src/map-atlas.js';
import {auditVanillaAtlasRawCells as audit} from '../src/map-cell-census.js';
const ptr=n=>0x08000000+n;
function d(r,o,n){for(let i=0;i<4;i++)r[o+i]=n>>>(8*i)&255;}
function fixture(){
 const rom=new Uint8Array(0x1000).fill(0xff);
 d(rom,0x100,ptr(0x140));
 for(let i=0;i<2;i++){
  const header=0x200+i*0x40,layout=0x300+i*0x40;
  d(rom,0x140+i*4,ptr(header));
  d(rom,header,ptr(layout));
  for(const o of [4,8,12])d(rom,header+o,0);
  d(rom,layout,2);d(rom,layout+4,2);
  for(const [o,t] of [[8,0x500],[12,0x400+i*0x20],[16,0x600],[20,0x620]])
   d(rom,layout+o,ptr(t));
 }
 for(let i=0;i<4;i++){
  const word=(i<<10)|(i+1);
  rom[0x400+i*2]=word&255;rom[0x401+i*2]=word>>>8;
  rom[0x420+i*2]=0;rom[0x421+i*2]=0;
 }
 return {rom,atlas:inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[2],family:'RSE'
 })};
}
test('census counts raw high bits across distinct maps, not walkability',()=>{
 const {rom,atlas}=fixture(),original=rom.slice();
 const r=audit(rom,atlas,{chunkSize:2});
 assert.equal(r.mapsInspected,2);
 assert.equal(r.uniqueBlockmaps,2);
 assert.equal(r.uniqueCells,8);
 assert.equal(r.logicalCells,8);
 assert.equal(r.nonzeroRawHighBitCells,3);
 assert.deepEqual(r.rawHighBitCounts.slice(0,5),[5,1,1,1,0]);
 assert.equal(r.rows[0].nonzeroRawHighBitCells,3);
 assert.equal(r.rows[1].nonzeroRawHighBitCells,0);
 assert.equal(r.walkabilityVerified,false);
 assert.equal(r.writeAuthorized,false);
 assert.ok(Object.isFrozen(r.rows)&&Object.isFrozen(r.rawHighBitCounts));
 assert.deepEqual(rom,original);
});
test('shared exact blockmaps are counted physically once and logically twice',()=>{
 const {rom}=fixture();
 d(rom,0x340+12,ptr(0x400));
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[2],family:'RSE'
 });
 const r=audit(rom,atlas);
 assert.equal(r.uniqueBlockmaps,1);
 assert.equal(r.uniqueCells,4);
 assert.equal(r.logicalCells,8);
 assert.equal(r.sharedMapReferences,1);
 assert.equal(r.rows[0].sharedBlockmapReferences,2);
 assert.equal(r.rows[1].sharedBlockmapReferences,2);
 assert.equal(r.nonzeroRawHighBitCells,3);
});
test('stale or forged atlas and unsafe budgets fail closed',()=>{
 const {rom,atlas}=fixture();
 assert.throws(()=>audit(rom,atlas,{maxMaps:1}),/no partial result/);
 assert.throws(()=>audit(rom,atlas,{maxUniqueCells:7}),/no partial result/);
 assert.throws(()=>audit(rom,atlas,{chunkSize:4097}),RangeError);
 assert.throws(()=>audit(rom,atlas,{maxRows:0}),RangeError);
 assert.equal(audit(rom,atlas,{maxRows:1}).rowsTruncated,true);
 d(rom,0x144,ptr(0x200));
 assert.throws(()=>audit(rom,atlas),/changed/);
});
test('overlapping distinct blockmaps fail instead of double counting',()=>{
 const {rom}=fixture();d(rom,0x34c,ptr(0x404));
 const atlas=inspectVanillaMapAtlas(rom,{
  address:0x100,bankMapCounts:[2],family:'RSE'
 });
 assert.throws(()=>audit(rom,atlas),/overlapping blockmaps/);
});
test('invalid accessor bytes fail closed',()=>{
 const {rom,atlas}=fixture();
 const reader={length:rom.length,read:i=>i===0x400?300:rom[i]};
 assert.throws(()=>audit(reader,atlas),/invalid byte/);
});
