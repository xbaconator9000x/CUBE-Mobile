import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {traceHmaCubeConnectionDestination} from '../src/hma-cube-connection-trace.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=(v>>>8)&255;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
  const text=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
    .replace('Address = 0x102D520','Address = 0x10');
  const bytes=new Uint8Array(4096);
  const summary=inspectHmaMapBankAnchorSources([{name:'cube_emerald.toml',text}],{romSize:bytes.length});
  ptr(bytes,0x10,0x100);ptr(bytes,0x14,0x120);
  ptr(bytes,0x100,0x200);ptr(bytes,0x120,0x240);
  for(const [header,layout,blockmap,connections] of [
    [0x200,0x280,0x300,0x600],[0x240,0x2c0,0x320,0x620]]){
    ptr(bytes,header,layout);ptr(bytes,header+12,connections);
    u32(bytes,layout,4);u32(bytes,layout+4,3);
    ptr(bytes,layout+8,0x400);ptr(bytes,layout+12,blockmap);
    ptr(bytes,layout+16,0x500);ptr(bytes,layout+20,0x540);
  }
  u32(bytes,0x600,1);ptr(bytes,0x604,0x700);
  u32(bytes,0x700,1);u32(bytes,0x704,0xfffffffe);
  bytes[0x708]=1;bytes[0x709]=0;
  u32(bytes,0x620,1);ptr(bytes,0x624,0x720);
  u32(bytes,0x720,2);u32(bytes,0x724,2);
  bytes[0x728]=0;bytes[0x729]=0;
  return {bytes,summary};
}
const opts={bankIndex:0,mapIndex:0,mapCount:1,connectionIndex:0,targetMapCount:1};
test('traces explicit cross-bank CUBE connection and raw backlink without mutation',async()=>{
  const {bytes,summary}=await fixture(),before=bytes.slice();
  const report=traceHmaCubeConnectionDestination(bytes,summary,opts);
  assert.equal(report.status,'resolved-raw');
  assert.deepEqual([report.targetBank,report.targetMap,report.targetWidth,report.targetHeight],[1,0,4,3]);
  assert.equal(report.rawReturnLinkPresent,true);
  assert.equal(report.backLinks.length,1);
  assert.equal(report.backLinks[0].direction,2);
  assert.equal(report.displacement,-2);
  assert.equal(report.travelVerified,false);
  assert.equal(report.writeAuthorized,false);
  assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.backLinks)&&Object.isFrozen(report.backLinks[0]));
  assert.deepEqual(bytes,before);
});
test('does not invent destination counts or travel for malformed, missing or special links',async()=>{
  const {bytes,summary}=await fixture();
  const run=extra=>traceHmaCubeConnectionDestination(bytes,summary,{...opts,...extra});
  assert.throws(()=>run({connectionIndex:1}),RangeError);
  assert.throws(()=>run({targetMapCount:0}),RangeError);
  assert.equal(run({targetMapCount:1}).status,'resolved-raw');
  bytes[0x709]=2;
  assert.equal(run({targetMapCount:1}).status,'outside-explicit-target-map-count');
  bytes[0x709]=255;
  assert.equal(run({targetMapCount:undefined}).status,'special-or-unresolved');
  bytes[0x709]=0;bytes[0x708]=1;
  ptr(bytes,0x120,0xFFF);
  assert.equal(run().status,'invalid-or-unsupported-target');
});
test('raw reciprocal records are not assumed when target has no return connection',async()=>{
  const {bytes,summary}=await fixture();
  bytes[0x728]=3;
  const report=traceHmaCubeConnectionDestination(bytes,summary,opts);
  assert.equal(report.status,'resolved-raw');
  assert.equal(report.rawReturnLinkPresent,false);
  assert.deepEqual(report.backLinks,[]);
});
