import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeScriptReferences,previewHmaCubeScriptRetargetBatch,verifyHmaCubeScriptRetargetDryRun} from '../src/hma-cube-script-retarget.js';
function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(){
 const toml=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
  .replace('Address = 0x102D520','Address = 0x10');
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
 ptr(bytes,0x204,0x600);
 bytes[0x600]=2;bytes[0x601]=1;bytes[0x602]=1;bytes[0x603]=2;
 for(const [at,to] of [[0x604,0x820],[0x608,0x800],[0x60c,0x860],[0x610,0x880]])ptr(bytes,at,to);
 ptr(bytes,0x820+16,0xa100);ptr(bytes,0x838+16,0xa110);
 ptr(bytes,0x860+12,0xa120);
 ptr(bytes,0x880+8,0xa130);
 bytes[0x88c+5]=5;u32(bytes,0x88c+8,0x12345678);
 return {bytes,summary};
}
const opts={bankIndex:0,mapIndex:0,mapCount:1};
test('distinguishes source-grounded script fields from hidden-item signpost union',async()=>{
 const {bytes,summary}=await fixture();
 const r=inspectHmaCubeScriptReferences(bytes,summary,opts);
 assert.equal(r.references.length,5);
 assert.equal(r.scriptBearingCount,4);
 assert.equal(r.hiddenItemUnionCount,1);
 assert.equal(r.validInRomTargetCount,4);
 assert.equal(r.references.find(x=>x.hiddenItemUnion).rawPointer,null);
 assert.equal(r.writeAuthorized,false);
});
test('retargets two different script kinds to existing targets and rolls back',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const changes=[
  {kind:'objects',index:0,expectedRaw:0x0800a100,targetKind:'scripts',targetIndex:0},
  {kind:'signposts',index:0,expectedRaw:0x0800a130,targetKind:'objects',targetIndex:1}
 ];
 const plan=previewHmaCubeScriptRetargetBatch(bytes,summary,{...opts,changes});
 assert.equal(plan.changedRecords,2);
 assert.equal(plan.changedBytes,4);
 assert.equal(plan.completeEventReDecodeVerified,true);
 const r=verifyHmaCubeScriptRetargetDryRun(bytes,summary,{...opts,changes});
 assert.equal(r.inMemoryRollbackVerified,true);
 assert.equal(r.sourceBytesPreserved,true);
 assert.equal(r.patchedRomExported,false);
 assert.deepEqual(bytes,original);
});
test('rejects hidden-item union, arbitrary target, stale expected and duplicates',async()=>{
 const {bytes,summary}=await fixture();
 const valid={kind:'objects',index:0,expectedRaw:0x0800a100,targetKind:'scripts',targetIndex:0};
 for(const changes of [
  [{...valid,kind:'signposts',index:1,expectedRaw:0x12345678}],
  [{...valid,targetKind:'signposts',targetIndex:1}],
  [{...valid,expectedRaw:0x0800a110}],
  [valid,valid],
  [{...valid,targetKind:'objects',targetIndex:0}]
 ])assert.throws(()=>previewHmaCubeScriptRetargetBatch(bytes,summary,{...opts,changes}),
  /hidden-item|unsupported|stale|duplicate|does not change/i);
});
test('rejects targets inside local map structures and out-of-ROM references',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0x860+12,0x820);
 const change={kind:'objects',index:0,expectedRaw:0x0800a100,targetKind:'scripts',targetIndex:0};
 assert.throws(()=>previewHmaCubeScriptRetargetBatch(bytes,summary,{...opts,changes:[change]}),
  /not an existing safe/);
 ptr(bytes,0x860+12,0x12000);
 assert.throws(()=>previewHmaCubeScriptRetargetBatch(bytes,summary,{...opts,changes:[change]}),
  /not an existing safe/);
});
test('bounded accessor remains immutable and malformed bytes fail closed',async()=>{
 const {bytes,summary}=await fixture(),changes=[
  {kind:'scripts',index:0,expectedRaw:0x0800a120,targetKind:'objects',targetIndex:1}
 ];
 const accessor={length:bytes.length,read:i=>bytes[i],
  write:()=>{throw Error('Forbidden write')}};
 assert.equal(verifyHmaCubeScriptRetargetDryRun(accessor,summary,{...opts,changes}).writeAuthorized,false);
 const bad={length:bytes.length,read:i=>i===0x86c?999:bytes[i]};
 assert.throws(()=>previewHmaCubeScriptRetargetBatch(bad,summary,{...opts,changes}),/invalid/i);
});
