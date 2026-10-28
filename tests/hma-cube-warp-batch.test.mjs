import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapEventWarps} from '../src/hma-cube-map-events.js';
import {previewHmaCubeWarpBatch,verifyHmaCubeWarpBatchDryRun} from '../src/hma-cube-warp-batch.js';

function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
const options={bankIndex:0,mapIndex:0,mapCount:1};
const targetBanks=[{bankIndex:0,mapCount:1}];
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
 ptr(bytes,0x200,0x280);ptr(bytes,0x204,0x600);
 u32(bytes,0x280,3);u32(bytes,0x284,2);
 ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
 ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
 bytes[0x601]=2;ptr(bytes,0x608,0x700);
 u16(bytes,0x700,1);u16(bytes,0x702,1);
 bytes[0x704]=3;bytes[0x705]=0;bytes[0x706]=0;bytes[0x707]=0;
 u16(bytes,0x708,2);u16(bytes,0x70a,1);
 bytes[0x70c]=3;bytes[0x70d]=0;bytes[0x70e]=0;bytes[0x70f]=0;
 return {bytes,summary};
}
function proposal(warpIndex,warps,proposed){
 const {x,y,elevation,warpId,targetMap,targetBank}=warps[warpIndex];
 return {warpIndex,expected:{x,y,elevation,warpId,targetMap,targetBank},proposed};
}
test('atomic two-warp preview traces both records together without mutating ROM',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const warps=inspectHmaCubeMapEventWarps(bytes,summary,options).warps;
 const changes=[proposal(0,warps,{warpId:1}),proposal(1,warps,{warpId:0,x:0})];
 const result=previewHmaCubeWarpBatch(bytes,summary,{...options,changes,targetBanks});
 assert.equal(result.changedRecords,2);
 assert.equal(result.changedBytes,2);
 assert.equal(result.beforeTopology.records[0].rawReturnToSameWarp,true);
 assert.equal(result.afterTopology.records[0].arrival.warpIndex,1);
 assert.equal(result.afterTopology.records[0].rawReturnToSameWarp,true);
 assert.equal(result.afterTopology.records[1].arrival.warpIndex,0);
 assert.equal(result.combinedReDecodeVerified,true);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(bytes,original);
});
test('two-warp isolated transaction re-decodes, compares, and fully rolls back',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const warps=inspectHmaCubeMapEventWarps(bytes,summary,options).warps;
 const changes=[proposal(0,warps,{warpId:1}),proposal(1,warps,{warpId:0,x:0})];
 const result=verifyHmaCubeWarpBatchDryRun(bytes,summary,{...options,changes,targetBanks});
 assert.equal(result.changedRecords,2);
 assert.equal(result.changedBytes,2);
 assert.equal(result.inMemoryRollbackVerified,true);
 assert.equal(result.unrelatedBytesPreserved,true);
 assert.equal(result.patchedRomExported,false);
 assert.deepEqual(bytes,original);
});
test('duplicate indices, stale originals and missing source count fail closed',async()=>{
 const {bytes,summary}=await fixture();
 const warps=inspectHmaCubeMapEventWarps(bytes,summary,options).warps;
 const a=proposal(0,warps,{warpId:1});
 const run=(changes,banks=targetBanks)=>previewHmaCubeWarpBatch(bytes,summary,{
  ...options,changes,targetBanks:banks
 });
 assert.throws(()=>run([a,a]),/Duplicate/i);
 assert.throws(()=>run([{...a,expected:{...a.expected,x:99}}]),/changed/i);
 assert.throws(()=>run([a],[{bankIndex:1,mapCount:1}]),/source bank count/i);
 assert.throws(()=>run([a],[]),/1–8/i);
 assert.throws(()=>run([]),/1–32/i);
 assert.throws(()=>run([proposal(0,warps,{x:99})]),/outside declared map/i);
});
test('source mutation during snapshot and oversized copies are rejected',async()=>{
 const {bytes,summary}=await fixture();
 const warps=inspectHmaCubeMapEventWarps(bytes,summary,options).warps;
 const changes=[proposal(0,warps,{warpId:1})];
 let reads=0;
 const unstable={length:bytes.length,read:i=>{
  if(i===0x705&&++reads>1)return 255;
  return bytes[i];
 }};
 assert.throws(()=>verifyHmaCubeWarpBatchDryRun(unstable,summary,{
  ...options,changes,targetBanks
 }),/Source changed during ROM snapshot/);
 assert.throws(()=>verifyHmaCubeWarpBatchDryRun({
  length:64*1024*1024+1,read:()=>0
 },summary,{...options,changes,targetBanks}),/64 MiB/);
});
