import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {auditHmaCubeWarpTopology} from '../src/hma-cube-warp-arrival.js';

function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);ptr(bytes,0x104,0x240);
 for(const [header,layout,events] of [[0x200,0x280,0x600],[0x240,0x2c0,0x640]]){
  ptr(bytes,header,layout);ptr(bytes,header+4,events);
  u32(bytes,layout,4);u32(bytes,layout+4,4);
  ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,0x300);
  ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
 }
 bytes[0x601]=2;ptr(bytes,0x608,0x800);
 bytes[0x641]=2;ptr(bytes,0x648,0x820);
 // Source map 0, warp 0 -> map 1 warp 0, and warp 1 -> map 1 warp 1.
 for(const [at,x,y,warpId,targetMap] of [[0x800,1,2,0,1],[0x808,2,2,1,1],
  [0x820,3,1,0,0],[0x828,0,0,0,0]]){
  u16(bytes,at,x);u16(bytes,at+2,y);
  bytes[at+5]=warpId;bytes[at+6]=targetMap;bytes[at+7]=0;
 }
 return {bytes,summary};
}
const options={bankIndex:0,mapIndex:0,mapCount:2,targetBanks:[{bankIndex:0,mapCount:2}]};
test('CUBE topology identifies exact reciprocal door vs wrong return index',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const result=auditHmaCubeWarpTopology(bytes,summary,options);
 assert.equal(result.inspectedWarps,2);
 assert.equal(result.records[0].status,'resolved-raw');
 assert.equal(result.records[0].rawReturnToSameWarp,true);
 assert.deepEqual(result.records[0].issues,[]);
 assert.equal(result.records[1].rawReturnToSameWarp,false);
 assert.deepEqual(result.records[1].issues,['return-points-to-different-source-warp']);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.travelVerified,false);
 assert.deepEqual(bytes,before);
});
test('CUBE topology reports missing counts, special destinations and out-of-map coordinates',async()=>{
 const {bytes,summary}=await fixture();
 let result=auditHmaCubeWarpTopology(bytes,summary,{...options,targetBanks:[{bankIndex:1,mapCount:1}]});
 assert.equal(result.records[0].status,'target-bank-count-not-declared');
 bytes[0x807]=255;
 result=auditHmaCubeWarpTopology(bytes,summary,options);
 assert.equal(result.records[0].status,'special-or-unresolved');
 bytes[0x807]=0;u16(bytes,0x800,9);u16(bytes,0x820,8);
 result=auditHmaCubeWarpTopology(bytes,summary,options);
 assert.ok(result.records[0].issues.includes('source-outside-map'));
 assert.ok(result.records[0].issues.includes('arrival-outside-map'));
});
test('CUBE topology rejects ambiguous counts and over-budget audits before partial results',async()=>{
 const {bytes,summary}=await fixture();
 for(const changes of [
  {...options,targetBanks:[]},
  {...options,targetBanks:[{bankIndex:0,mapCount:2},{bankIndex:0,mapCount:2}]},
  {...options,targetBanks:[{bankIndex:0,mapCount:0}]},
  {...options,maxWarps:1},
  {...options,maxWarps:65}
 ])assert.throws(()=>auditHmaCubeWarpTopology(bytes,summary,changes),RangeError);
});
test('CUBE topology marks duplicate source coordinates without inferring walkability',async()=>{
 const {bytes,summary}=await fixture();
 u16(bytes,0x808,1);u16(bytes,0x80a,2);
 const result=auditHmaCubeWarpTopology(bytes,summary,options);
 assert.ok(result.records.every(x=>x.issues.includes('shared-source-coordinate')));
 assert.equal(result.cubeLayoutAuthenticated,false);
});
