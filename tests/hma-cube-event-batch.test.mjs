import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapEventWarps} from '../src/hma-cube-map-events.js';
import {previewHmaCubeEventPositionBatch,verifyHmaCubeEventPositionBatchDryRun} from '../src/hma-cube-event-batch.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
const options={bankIndex:0,mapIndex:0,mapCount:1};
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
 ptr(bytes,0x200,0x280);ptr(bytes,0x204,0x600);
 u32(bytes,0x280,5);u32(bytes,0x284,4);
 ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
 ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
 bytes[0x600]=1;bytes[0x601]=1;bytes[0x602]=1;bytes[0x603]=1;
 ptr(bytes,0x604,0x700);ptr(bytes,0x608,0x740);
 ptr(bytes,0x60c,0x780);ptr(bytes,0x610,0x7c0);
 u16(bytes,0x704,1);u16(bytes,0x706,1);bytes[0x708]=2;
 u16(bytes,0x740,3);u16(bytes,0x742,1);
 u16(bytes,0x780,2);u16(bytes,0x782,2);u16(bytes,0x784,400);
 u16(bytes,0x7c0,4);u16(bytes,0x7c2,3);bytes[0x7c4]=4;
 return {bytes,summary};
}
function edit(kind,events,proposed){
 const {x,y,elevation}=events.arrays[kind][0];
 return {kind,index:0,expected:{x,y,elevation},proposed};
}
test('three-kind event move is atomic and reports coordinated destination collisions',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const events=inspectHmaCubeMapEventWarps(bytes,summary,options);
 const changes=[edit('objects',events,{x:2,y:2}),
  edit('scripts',events,{x:2,y:2,elevation:511}),
  edit('signposts',events,{x:2,y:2})];
 const plan=previewHmaCubeEventPositionBatch(bytes,summary,{...options,changes});
 assert.equal(plan.changedRecords,3);
 assert.equal(plan.colocatedDestinations.length,1);
 assert.equal(plan.colocatedDestinations[0].occupants.length,3);
 assert.equal(plan.combinedReDecodeVerified,true);
 assert.equal(plan.writeAuthorized,false);
 assert.deepEqual(bytes,original);
});
test('combined event transaction re-decodes and rolls back every field',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const events=inspectHmaCubeMapEventWarps(bytes,summary,options);
 const changes=[edit('objects',events,{x:2,y:2}),
  edit('scripts',events,{elevation:511}),
  edit('signposts',events,{x:1,y:1})];
 const result=verifyHmaCubeEventPositionBatchDryRun(bytes,summary,{...options,changes});
 assert.equal(result.changedRecords,3);
 assert.equal(result.inMemoryRollbackVerified,true);
 assert.equal(result.unrelatedBytesPreserved,true);
 assert.equal(result.patchedRomExported,false);
 assert.deepEqual(bytes,original);
});
test('duplicate records, stale expected fields, invalid proposals and empty batches fail closed',async()=>{
 const {bytes,summary}=await fixture();
 const events=inspectHmaCubeMapEventWarps(bytes,summary,options);
 const a=edit('objects',events,{x:2});
 const run=changes=>previewHmaCubeEventPositionBatch(bytes,summary,{...options,changes});
 assert.throws(()=>run([a,a]),/Duplicate/i);
 assert.throws(()=>run([{...a,expected:{...a.expected,y:99}}]),/changed/i);
 assert.throws(()=>run([edit('signposts',events,{x:5})]),/outside declared map/i);
 assert.throws(()=>run([]),/1–32/i);
 assert.throws(()=>run([{...a,kind:'warps'}]),/Only objects/i);
});
