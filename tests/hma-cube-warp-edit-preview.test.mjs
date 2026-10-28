import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeMapEventWarps} from '../src/hma-cube-map-events.js';
import {previewHmaCubeWarpRecordChange,verifyHmaCubeWarpRecordDryRun} from '../src/hma-cube-warp-edit-preview.js';

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
 u32(bytes,0x280,3);u32(bytes,0x284,2);
 ptr(bytes,0x288,0x400);ptr(bytes,0x28c,0x300);
 ptr(bytes,0x290,0x500);ptr(bytes,0x294,0x540);
 bytes[0x601]=2;ptr(bytes,0x608,0x700);
 u16(bytes,0x700,1);u16(bytes,0x702,1);bytes[0x704]=3;
 bytes[0x705]=4;bytes[0x706]=5;bytes[0x707]=6;
 u16(bytes,0x708,2);u16(bytes,0x70a,1);
 bytes[0x70d]=255;bytes[0x70e]=255;bytes[0x70f]=255;
 return {bytes,summary};
}
test('CUBE warp destination edit re-decodes virtual source and raw arrival without writing',async()=>{
 const {bytes,summary}=await fixture(),copy=bytes.slice();
 const original=inspectHmaCubeMapEventWarps(bytes,summary,options).warps[0];
 const expected={x:original.x,y:original.y,elevation:original.elevation,
  warpId:original.warpId,targetMap:original.targetMap,targetBank:original.targetBank};
 const result=previewHmaCubeWarpRecordChange(bytes,summary,{
  ...options,warpIndex:0,expected,
  proposed:{warpId:0,targetMap:0,targetBank:0},
  targetBanks:[{bankIndex:0,mapCount:1}]
 });
 assert.deepEqual(result.changedFields,['warpId','targetMap','targetBank']);
 assert.equal(result.beforeTrace.status,'target-bank-count-not-declared');
 assert.equal(result.afterTrace.status,'resolved-raw');
 assert.equal(result.afterTrace.arrival.returnsToOrigin,true);
 assert.equal(result.afterTrace.arrival.returnWarpId,0);
 assert.equal(result.otherWarpsPreserved,true);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.authenticSaveReopenVerified,false);
 assert.deepEqual(bytes,copy);
 assert.ok(Object.isFrozen(result.after));
});
test('stale records, invalid coordinates, unsupported fields and malformed banks fail closed',async()=>{
 const {bytes,summary}=await fixture();
 const warp=inspectHmaCubeMapEventWarps(bytes,summary,options).warps[0];
 const expected={x:warp.x,y:warp.y,elevation:warp.elevation,warpId:warp.warpId,
  targetMap:warp.targetMap,targetBank:warp.targetBank};
 const run=extra=>previewHmaCubeWarpRecordChange(bytes,summary,{
  ...options,warpIndex:0,expected,proposed:{targetMap:0},...extra
 });
 assert.throws(()=>run({expected:{...expected,targetBank:1}}),/changed/i);
 assert.throws(()=>run({proposed:{x:3}}),/outside declared map/i);
 assert.throws(()=>run({proposed:{bogus:1}}),/supported/i);
 assert.throws(()=>run({proposed:{targetBank:256}}),/bounds/i);
 assert.throws(()=>run({targetBanks:[{bankIndex:0,mapCount:1},{bankIndex:0,mapCount:1}]}),/Duplicate/i);
 assert.throws(()=>run({warpIndex:2}),RangeError);
 const preview=run({targetBanks:[]});
 assert.equal(preview.afterTrace.status,'target-bank-count-not-declared');
 assert.equal(preview.writeAuthorized,false);
});
test('invalid staged source bytes cannot pass warp preflight',async()=>{
 const {bytes,summary}=await fixture();
 const warp=inspectHmaCubeMapEventWarps(bytes,summary,options).warps[0];
 const expected={x:warp.x,y:warp.y,elevation:warp.elevation,warpId:warp.warpId,
  targetMap:warp.targetMap,targetBank:warp.targetBank};
 const source={length:bytes.length,read:i=>i===0x707?300:bytes[i]};
 assert.throws(()=>previewHmaCubeWarpRecordChange(source,summary,{
  ...options,warpIndex:0,expected,proposed:{targetBank:0}
 }),RangeError);
});

test('copy-only CUBE warp transaction re-decodes, traces and rolls back exact bytes',async()=>{
 const {bytes,summary}=await fixture(),copy=bytes.slice();
 const original=inspectHmaCubeMapEventWarps(bytes,summary,options).warps[0];
 const expected={x:original.x,y:original.y,elevation:original.elevation,
  warpId:original.warpId,targetMap:original.targetMap,targetBank:original.targetBank};
 const result=verifyHmaCubeWarpRecordDryRun(bytes,summary,{
  ...options,warpIndex:0,expected,proposed:{warpId:0,targetMap:0,targetBank:0},
  targetBanks:[{bankIndex:0,mapCount:1}]
 });
 assert.equal(result.inMemoryReDecodeVerified,true);
 assert.equal(result.inMemoryRollbackVerified,true);
 assert.equal(result.unrelatedBytesPreserved,true);
 assert.equal(result.afterTrace.status,'resolved-raw');
 assert.equal(result.afterTrace.arrival.returnsToOrigin,true);
 assert.equal(result.changedBytes,3);
 assert.equal(result.writeAuthorized,false);
 assert.equal(result.patchedRomExported,false);
 assert.deepEqual(bytes,copy);
});
test('copy-only CUBE warp rehearsal refuses invalid source and stale warp fields',async()=>{
 const {bytes,summary}=await fixture();
 const warp=inspectHmaCubeMapEventWarps(bytes,summary,options).warps[0];
 const expected={x:warp.x,y:warp.y,elevation:warp.elevation,warpId:warp.warpId,
  targetMap:warp.targetMap,targetBank:warp.targetBank};
 assert.throws(()=>verifyHmaCubeWarpRecordDryRun(bytes,summary,{
  ...options,warpIndex:0,expected:{...expected,targetBank:99},
  proposed:{targetBank:0}
 }),/changed/i);
 assert.throws(()=>verifyHmaCubeWarpRecordDryRun({
  length:64*1024*1024+1,read:()=>0
 },summary,{...options,warpIndex:0,expected,proposed:{targetBank:0}}),/64 MiB/);
 let calls=0;
 const unstable={length:bytes.length,read:i=>{
  if(i===0x707&&++calls>1)return (bytes[i]+1)&255;
  return bytes[i];
 }};
 assert.throws(()=>verifyHmaCubeWarpRecordDryRun(unstable,summary,{
  ...options,warpIndex:0,expected,proposed:{targetBank:0}
 }),/Source changed while copying/);
});
