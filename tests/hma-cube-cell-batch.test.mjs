import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {previewHmaCubeCellBatch,verifyHmaCubeCellBatchDryRun} from '../src/hma-cube-cell-batch.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const toml=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8')).replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(0xe000);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text:toml}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);ptr(bytes,0x200,0x280);
 u32(bytes,0x280,2);u32(bytes,0x284,1);
 for(const [at,to] of [[0x288,0x400],[0x28c,0x300],[0x290,0x500],[0x294,0x540]])ptr(bytes,at,to);
 for(const [at,secondary] of [[0x500,0],[0x540,1]]){
  bytes[at+1]=secondary;
  ptr(bytes,at+4,secondary?0x5000:0x1000);
  ptr(bytes,at+8,secondary?0x9200:0x9000);
  ptr(bytes,at+12,secondary?0xb400:0x9400);
  ptr(bytes,at+16,secondary?0xd800:0xd400);
 }
 bytes.fill(0x11,0x1000,0x1020);bytes.fill(0x22,0x5000,0x5020);
 u16(bytes,0x9002,0x001f);u16(bytes,0x9200+6*32+4,0x7c00);
 for(let i=0;i<8;i++){u16(bytes,0x9400+i*2,0);u16(bytes,0xb400+i*2,512|(6<<12));}
 return {bytes,summary};
}
const options={bankIndex:0,mapIndex:0,mapCount:1,x:0,y:0,viewportWidth:2,viewportHeight:1};
test('batch previews two changes atomically, with immutable source and pixel diff',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const result=previewHmaCubeCellBatch(bytes,summary,{...options,
  changes:[{x:0,y:0,tileId:512,expectedRaw:0},
           {x:1,y:0,collision:47,expectedRaw:0}]});
 assert.equal(result.changedCells,2);
 assert.equal(result.changedPixels,256);
 assert.equal(result.changes[1].after.raw,47<<10);
 assert.equal(result.beforeImage.width,32);
 assert.equal(result.afterImage.width,32);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.exclusiveOwnershipProven,false);
 assert.ok(Object.isFrozen(result.changes[0]));
 assert.deepEqual(bytes,original);
});
test('rejects stale, duplicate, outside viewport and untyped proposals',async()=>{
 const {bytes,summary}=await fixture();
 const run=changes=>previewHmaCubeCellBatch(bytes,summary,{...options,changes});
 for(const changes of [
  [{x:0,y:0,tileId:1,expectedRaw:1}],
  [{x:0,y:0,tileId:1,expectedRaw:0},{x:0,y:0,collision:2,expectedRaw:0}],
  [{x:0,y:1,tileId:1,expectedRaw:0}],
  [{x:0,y:0,tileId:1}],
  [{x:0,y:0,expectedRaw:0}],
  [{x:0,y:0,tileId:1024,expectedRaw:0}]
 ])assert.throws(()=>run(changes));
 assert.throws(()=>run([]),RangeError);
 assert.throws(()=>run(Array.from({length:33},()=>({x:0,y:0,tileId:1,expectedRaw:0}))),RangeError);
});
test('optional ownership census never grants write authority',async()=>{
 const {bytes,summary}=await fixture();
 const result=previewHmaCubeCellBatch(bytes,summary,{...options,
  changes:[{x:0,y:0,tileId:1,expectedRaw:0}],
  banks:[{bankIndex:0,mapCount:1}]});
 assert.equal(result.ownership.invalidMaps,0);
 assert.equal(result.ownership.overlapCount,0);
 assert.equal(result.ownership.exclusiveOwnershipProven,false);
 assert.equal(result.writeAuthorized,false);
 assert.throws(()=>previewHmaCubeCellBatch(bytes,summary,{...options,
  changes:[{x:0,y:0,tileId:1,expectedRaw:0}],
  banks:[{bankIndex:1,mapCount:1}]}),RangeError);
});
test('rejects unsupported CUBE lighting and never calls source writes',async()=>{
 const {bytes,summary}=await fixture();
 const staged={length:bytes.length,read:i=>bytes[i],write:()=>{throw Error('WRITING FORBIDDEN')}};
 bytes[0x502]=1;
 assert.throws(()=>previewHmaCubeCellBatch(staged,summary,{...options,
  changes:[{x:0,y:0,tileId:512,expectedRaw:0}]}),/light/i);
});

test('batch preview identifies event records on changed cells without inferring passability',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 ptr(bytes,0x204,0x600);bytes[0x601]=1;ptr(bytes,0x608,0x800);
 u16(bytes,0x800,0);u16(bytes,0x802,0);
 const original=bytes.slice();
 const result=previewHmaCubeCellBatch(bytes,summary,{...options,
  changes:[{x:0,y:0,tileId:1,collision:3,expectedRaw:0}]});
 assert.equal(result.eventInspectionStatus,'decoded');
 assert.equal(result.eventRecordsAffected,1);
 assert.equal(result.eventImpacts[0].rawHighBitsChanged,true);
 assert.equal(result.eventImpacts[0].tileChanged,true);
 assert.deepEqual(result.eventImpacts[0].events.map(e=>e.kind),['warps']);
 assert.equal(result.walkabilityVerified,false);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(bytes,original);
});
test('invalid event array never masquerades as a clean edit impact report',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x204,0x600);bytes[0x601]=1;
 const result=previewHmaCubeCellBatch(bytes,summary,{...options,
  changes:[{x:0,y:0,tileId:1,expectedRaw:0}]});
 assert.equal(result.eventInspectionStatus,'unavailable');
 assert.equal(result.eventRecordsAffected,0);
 assert.equal(result.writeAuthorized,false);
});

test('copy-only CUBE transaction re-decodes exact bytes and reverses changes',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const result=verifyHmaCubeCellBatchDryRun(bytes,summary,{...options,
  changes:[{x:0,y:0,tileId:512,expectedRaw:0},
           {x:1,y:0,collision:47,expectedRaw:0}]});
 assert.equal(result.changedCells,2);
 assert.equal(result.changedBytes,3);
 assert.equal(result.inMemoryReDecodeVerified,true);
 assert.equal(result.inMemoryRollbackVerified,true);
 assert.equal(result.authenticSaveReopenVerified,false);
 assert.equal(result.patchedRomExported,false);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(bytes,original);
});
test('copy-only CUBE transaction refuses stale originals and invalid ROM bytes',async()=>{
 const {bytes,summary}=await fixture();
 const changes=[{x:0,y:0,tileId:512,expectedRaw:0}];
 assert.throws(()=>verifyHmaCubeCellBatchDryRun(bytes,summary,{
  ...options,changes:[{...changes[0],expectedRaw:1}]}),/changed/i);
 const reader={length:bytes.length,read:i=>i===0x300?300:bytes[i]};
 assert.throws(()=>verifyHmaCubeCellBatchDryRun(reader,summary,{...options,changes}),RangeError);
 assert.throws(()=>verifyHmaCubeCellBatchDryRun(new Uint8Array(0),summary,{...options,changes}),RangeError);
});
