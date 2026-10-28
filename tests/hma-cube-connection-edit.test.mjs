import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {previewHmaCubeConnectionBatch,verifyHmaCubeConnectionBatchDryRun}
 from '../src/hma-cube-connection-edit.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
 const bytes=new Uint8Array(4096);
 const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
 ptr(bytes,0x10,0x100);ptr(bytes,0x100,0x200);
 ptr(bytes,0x200,0x280);ptr(bytes,0x20c,0x600);
 u32(bytes,0x280,5);u32(bytes,0x284,4);
 ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
 ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
 u32(bytes,0x600,2);ptr(bytes,0x604,0x700);
 u32(bytes,0x700,1);u32(bytes,0x704,0xFFFFFFFE);
 bytes[0x708]=0;bytes[0x709]=0;u16(bytes,0x70a,0xABCD);
 u32(bytes,0x70c,2);u32(bytes,0x710,3);
 bytes[0x714]=0;bytes[0x715]=0;u16(bytes,0x716,0x1234);
 return {bytes,summary};
}
const options={bankIndex:0,mapIndex:0,mapCount:1,targetBanks:[{bankIndex:0,mapCount:1}]};
const expected0={direction:1,rawDisplacement:0xFFFFFFFE,targetBank:0,targetMap:0,unused:0xABCD};
const expected1={direction:2,rawDisplacement:3,targetBank:0,targetMap:0,unused:0x1234};
test('atomic two-record raw connection preview re-decodes and preserves unrelated fields',async()=>{
 const {bytes,summary}=await fixture(),before=bytes.slice();
 const changes=[
  {connectionIndex:0,expected:expected0,proposed:{rawDisplacement:0xFFFFFFFD}},
  {connectionIndex:1,expected:expected1,proposed:{targetMap:1,unused:0x1234}}
 ];
 const r=previewHmaCubeConnectionBatch(bytes,summary,{...options,changes});
 assert.equal(r.changedRecords,2);
 assert.equal(r.changedBytes,2);
 assert.equal(r.combinedReDecodeVerified,true);
 assert.equal(r.changes[0].after.direction,1);
 assert.equal(r.changes[0].after.unused,0xABCD);
 assert.equal(r.changes[1].targetStatus,'outside-explicit-count');
 assert.equal(r.writeAuthorized,false);
 assert.deepEqual(bytes,before);
 const verified=verifyHmaCubeConnectionBatchDryRun(bytes,summary,{...options,changes});
 assert.equal(verified.changedBytes,2);
 assert.equal(verified.inMemoryRollbackVerified,true);
 assert.equal(verified.sourceBytesPreserved,true);
 assert.equal(verified.patchedRomExported,false);
 assert.deepEqual(bytes,before);
});
test('rejects duplicate, stale, malformed and out-of-bounds raw connection edits',async()=>{
 const {bytes,summary}=await fixture();
 const c={connectionIndex:0,expected:expected0,proposed:{direction:3}};
 const run=changes=>previewHmaCubeConnectionBatch(bytes,summary,{...options,changes});
 assert.throws(()=>run([]),/1–32/);
 assert.throws(()=>run([c,c]),/duplicate/i);
 assert.throws(()=>run([{...c,connectionIndex:99}]),/index/i);
 assert.throws(()=>run([{...c,expected:{...expected0,direction:9}}]),/stale|expected/i);
 assert.throws(()=>run([{...c,proposed:{direction:0x100000000}}]),/bounds/i);
 assert.throws(()=>run([{...c,proposed:{invalid:1}}]),/supported/i);
 assert.throws(()=>run([{...c,proposed:{}}]),/supported/i);
});
test('read-only accessor is never written and mutated source is rejected',async()=>{
 const {bytes,summary}=await fixture();
 const reader={length:bytes.length,read:i=>bytes[i],write:()=>{throw Error('FORBIDDEN')}};
 const changes=[{connectionIndex:0,expected:expected0,proposed:{targetBank:1}}];
 const r=verifyHmaCubeConnectionBatchDryRun(reader,summary,{...options,changes});
 assert.equal(r.sourceBytesPreserved,true);
 assert.equal(r.writeAuthorized,false);
 const bad={length:bytes.length,read:i=>i===0x700?999:bytes[i]};
 assert.throws(()=>previewHmaCubeConnectionBatch(bad,summary,{...options,changes}),/Invalid staged|byte/i);
});
