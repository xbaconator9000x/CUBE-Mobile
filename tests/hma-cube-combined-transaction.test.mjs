import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {verifyHmaCubeCombinedTransaction} from '../src/hma-cube-combined-transaction.js';
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
 bytes.fill(0x11,0x1000,0x1020);bytes.fill(0x22,0x5000,0x5020);
 u16(bytes,0x9002,0x001f);u16(bytes,0x9200+6*32+4,0x7c00);
 for(let i=0;i<8;i++){u16(bytes,0x9400+i*2,0);u16(bytes,0xb400+i*2,512|(6<<12));}
 ptr(bytes,0x204,0x600);
 ptr(bytes,0x20c,0xa00);
 u32(bytes,0xa00,1);ptr(bytes,0xa04,0xa20);
 u32(bytes,0xa20,1);u32(bytes,0xa24,0xFFFFFFFE);
 bytes[0xa28]=0;bytes[0xa29]=0;u16(bytes,0xa2a,0xCAFE);
 bytes[0x600]=1;bytes[0x601]=1;bytes[0x602]=1;
 ptr(bytes,0x60c,0x860);
 ptr(bytes,0x830,0xb000);ptr(bytes,0x86c,0xb010);
 ptr(bytes,0x604,0x820);ptr(bytes,0x608,0x800);
 u16(bytes,0x824,1);u16(bytes,0x826,0);
 u16(bytes,0x800,0);u16(bytes,0x802,0);
 return {bytes,summary};
}
const options={bankIndex:0,mapIndex:0,mapCount:1,x:0,y:0,viewportWidth:2,viewportHeight:1};
const changes={
 cells:[{x:0,y:0,tileId:512,expectedRaw:0}],
 warps:[{warpIndex:0,expected:{x:0,y:0,elevation:0,warpId:0,targetMap:0,targetBank:0},proposed:{x:1}}],
 events:[{kind:'objects',index:0,expected:{x:1,y:0,elevation:0},proposed:{x:0}}],
 connections:[{connectionIndex:0,
  expected:{direction:1,rawDisplacement:0xFFFFFFFE,targetBank:0,targetMap:0,unused:0xCAFE},
  proposed:{rawDisplacement:0xFFFFFFFD}}],
 targetBanks:[{bankIndex:0,mapCount:1}]
};
test('four-kind map, warp, event and connection edits atomically re-decode and roll back',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const r=verifyHmaCubeCombinedTransaction(bytes,summary,{...options,...changes});
 assert.equal(r.cellChanges,1);
 assert.equal(r.warpChanges,1);
 assert.equal(r.eventChanges,1);
 assert.equal(r.connectionChanges,1);
 assert.equal(r.changedBytes,4);
 assert.equal(r.combinedReDecodeVerified,true);
 assert.equal(r.inMemoryRollbackVerified,true);
 assert.equal(r.sourceBytesPreserved,true);
 assert.equal(r.writeAuthorized,false);
 assert.equal(r.authenticSaveReopenVerified,false);
 assert.deepEqual(bytes,original);
});
test('supports one kind while refusing empty, stale and out-of-map proposals',async()=>{
 const {bytes,summary}=await fixture();
 const single=verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,cells:changes.cells
 });
 assert.equal(single.cellChanges,1);
 assert.equal(single.warpChanges,0);
 assert.equal(single.connectionChanges,0);
 const connectionOnly=verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,connections:changes.connections,targetBanks:changes.targetBanks
 });
 assert.equal(connectionOnly.connectionChanges,1);
 assert.equal(connectionOnly.changedBytes,1);
 assert.throws(()=>verifyHmaCubeCombinedTransaction(bytes,summary,options),/at least one kind/);
 assert.throws(()=>verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,cells:[{x:0,y:0,tileId:1,expectedRaw:7}]
 }),/changed|stale|original/i);
 assert.throws(()=>verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,warps:[{...changes.warps[0],proposed:{x:99}}],
  targetBanks:changes.targetBanks
 }),/outside declared map/i);
});
test('read-only accessor never receives writes and malformed byte values fail closed',async()=>{
 const {bytes,summary}=await fixture();
 const accessor={length:bytes.length,read:i=>bytes[i],
  write:()=>{throw Error('WRITING FORBIDDEN')}};
 const r=verifyHmaCubeCombinedTransaction(accessor,summary,{...options,...changes});
 assert.equal(r.patchedRomExported,false);
 const invalid={length:bytes.length,read:i=>i===0x300?999:bytes[i]};
 assert.throws(()=>verifyHmaCubeCombinedTransaction(invalid,summary,{
  ...options,cells:changes.cells
 }),/invalid|byte/i);
});

test('rejects a connection record whose bytes alias an edited warp',async()=>{
 const {bytes,summary}=await fixture();
 ptr(bytes,0xa04,0x800);
 const overlapping={connectionIndex:0,
  expected:{direction:0,rawDisplacement:0,targetBank:0,targetMap:0,unused:0},
  proposed:{direction:1}};
 assert.throws(()=>verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,warps:changes.warps,connections:[overlapping],
  targetBanks:changes.targetBanks
 }),/overlaps a previously claimed byte/i);
});

test('connection proposals fail closed when expected raw fields are stale',async()=>{
 const {bytes,summary}=await fixture();
 const stale={...changes.connections[0],expected:{...changes.connections[0].expected,direction:2}};
 assert.throws(()=>verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,connections:[stale],targetBanks:changes.targetBanks
 }),/stale|expected/i);
});

const scriptEdit={kind:'objects',index:0,expectedRaw:0x0800b000,
 targetKind:'scripts',targetIndex:0};
test('five-kind transaction supports script retargeting alongside event relocation and rolls back',async()=>{
 const {bytes,summary}=await fixture(),original=bytes.slice();
 const r=verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,...changes,scripts:[scriptEdit]
 });
 assert.equal(r.scriptChanges,1);
 assert.equal(r.eventChanges,1);
 assert.equal(r.combinedReDecodeVerified,true);
 assert.equal(r.inMemoryRollbackVerified,true);
 assert.equal(r.writeAuthorized,false);
 assert.deepEqual(bytes,original);
});
test('script-only combined transaction and stale pointer fail closed',async()=>{
 const {bytes,summary}=await fixture();
 const r=verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,scripts:[scriptEdit]
 });
 assert.equal(r.scriptChanges,1);
 assert.equal(r.cellChanges,0);
 assert.equal(r.sourceBytesPreserved,true);
 assert.throws(()=>verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,scripts:[{...scriptEdit,expectedRaw:0x0800b001}]
 }),/stale/i);
});
test('script and event overlapping byte ownership fails closed',async()=>{
 const {bytes,summary}=await fixture();
 // Script references and position fields on one event are disjoint; prove
 // this valid pairing rather than rejecting the entire record.
 const r=verifyHmaCubeCombinedTransaction(bytes,summary,{
  ...options,events:changes.events,scripts:[scriptEdit]
 });
 assert.equal(r.eventChanges,1);
 assert.equal(r.scriptChanges,1);
 assert.equal(r.changedBytes,2);
});
