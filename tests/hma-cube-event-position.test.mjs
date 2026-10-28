import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapEventWarps} from '../src/hma-cube-map-events.js';
import {previewHmaCubeEventPositionChange,verifyHmaCubeEventPositionDryRun} from '../src/hma-cube-event-position.js';
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
function proposal(kind,records,proposed){
 const {x,y,elevation}=records.arrays[kind][0];
 return {...options,kind,index:0,expected:{x,y,elevation},proposed};
}
test('CUBE object relocation preserves all other event records and raw fields',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const records=inspectHmaCubeMapEventWarps(bytes,summary,options);
 const result=previewHmaCubeEventPositionChange(bytes,summary,
  proposal('objects',records,{x:2,y:2,elevation:3}));
 assert.deepEqual(result.changedFields,['x','y','elevation']);
 assert.equal(result.colocatedEvents[0].kind,'scripts');
 assert.equal(result.virtualReDecodeVerified,true);
 assert.equal(result.writeAuthorized,false);
 assert.deepEqual(bytes,original);
});
test('16-bit trigger elevation survives isolated copy apply and rollback',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const records=inspectHmaCubeMapEventWarps(bytes,summary,options);
 const opts=proposal('scripts',records,{x:3,elevation:511});
 const result=verifyHmaCubeEventPositionDryRun(bytes,summary,opts);
 assert.equal(result.changedBytes,2);
 assert.equal(result.inMemoryRollbackVerified,true);
 assert.equal(result.unrelatedBytesPreserved,true);
 assert.deepEqual(bytes,original);
});
test('signpost move checks exact original and rejects unsupported or out-of-map fields',async()=>{
 const {bytes,summary}=await fixture();
 const records=inspectHmaCubeMapEventWarps(bytes,summary,options);
 const opts=proposal('signposts',records,{x:1});
 assert.equal(previewHmaCubeEventPositionChange(bytes,summary,opts).after.x,1);
 assert.throws(()=>previewHmaCubeEventPositionChange(bytes,summary,{
  ...opts,expected:{...opts.expected,x:1}
 }),/changed/i);
 assert.throws(()=>previewHmaCubeEventPositionChange(bytes,summary,{
  ...opts,proposed:{x:5}
 }),/outside declared map/i);
 assert.throws(()=>previewHmaCubeEventPositionChange(bytes,summary,{
  ...opts,proposed:{scriptPointer:1}
 }),/supported/i);
 assert.throws(()=>previewHmaCubeEventPositionChange(bytes,summary,{
  ...opts,proposed:{elevation:256}
 }),/range/i);
 assert.throws(()=>previewHmaCubeEventPositionChange(bytes,summary,{
  ...opts,kind:'warps'
 }),/Only objects/i);
});
test('unstable source and oversized rehearsal fail without mutating ROM',async()=>{
 const {bytes,summary}=await fixture();
 const records=inspectHmaCubeMapEventWarps(bytes,summary,options);
 const opts=proposal('objects',records,{x:3});
 let calls=0;
 const unstable={length:bytes.length,read:i=>{
  if(i===0x704&&++calls>1)return 255;
  return bytes[i];
 }};
 assert.throws(()=>verifyHmaCubeEventPositionDryRun(unstable,summary,opts),
  /Source changed during ROM snapshot/);
 assert.throws(()=>verifyHmaCubeEventPositionDryRun({
  length:64*1024*1024+1,read:()=>0
 },summary,opts),/64 MiB/);
});
