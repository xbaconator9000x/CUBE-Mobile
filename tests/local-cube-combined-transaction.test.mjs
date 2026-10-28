import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectLocalCubeCombinedTransaction} from '../scripts/local-cube-combined-transaction.mjs';

const cli=fileURLToPath(new URL('../scripts/local-cube-combined-transaction.mjs',import.meta.url));
function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
const edit={
 cells:[{x:0,y:0,tileId:512,expectedRaw:0}],
 warps:[{warpIndex:0,expected:{x:0,y:0,elevation:0,warpId:0,targetMap:0,targetBank:0},proposed:{x:1}}],
 events:[{kind:'objects',index:0,expected:{x:1,y:0,elevation:0},proposed:{x:0}}],
 connections:[{connectionIndex:0,expected:{direction:1,rawDisplacement:0xFFFFFFFE,
  targetBank:0,targetMap:0,unused:0xCAFE},proposed:{rawDisplacement:0xFFFFFFFD}}],
 scripts:[{kind:'objects',index:0,expectedRaw:0x0800b000,targetKind:'scripts',targetIndex:0}],
 viewport:{x:0,y:0,viewportWidth:2,viewportHeight:1}
};
async function fixture(run){
 const dir=await mkdtemp(join(tmpdir(),'cube-combined-local-'));
 try{
  const rom=join(dir,'synthetic.gba'),metadata=join(dir,'synthetic.toml'),plan=join(dir,'edits.json');
  const bytes=new Uint8Array(0xe000);
  const toml=(await readFile(new URL('./fixtures/cubhmacube-map-bank-anchor.toml',import.meta.url),'utf8'))
   .replace('Address = 0x102D520','Address = 0x10');
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
  ptr(bytes,0x204,0x600);ptr(bytes,0x20c,0xa00);
  u32(bytes,0xa00,1);ptr(bytes,0xa04,0xa20);
  u32(bytes,0xa20,1);u32(bytes,0xa24,0xFFFFFFFE);
  u16(bytes,0xa2a,0xCAFE);
  bytes[0x600]=1;bytes[0x601]=1;bytes[0x602]=1;
  ptr(bytes,0x60c,0x860);ptr(bytes,0x604,0x820);ptr(bytes,0x608,0x800);
  ptr(bytes,0x830,0xb000);ptr(bytes,0x86c,0xb010);
  u16(bytes,0x824,1);u16(bytes,0x826,0);
  u16(bytes,0x800,0);u16(bytes,0x802,0);
  await writeFile(rom,bytes);await writeFile(metadata,toml);await writeFile(plan,JSON.stringify(edit));
  const hash=createHash('sha256').update(bytes).digest('hex');
  const args=['--rom',rom,'--metadata',metadata,'--expected-sha256',hash,
   '--bank-index','0','--map-index','0','--map-count','1','--plan',plan,'--banks','0:1'];
  return await run({dir,rom,metadata,plan,bytes,hash,args});
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('five kinds re-decode and roll back on disk without exporting edited ROM',async()=>{
 await fixture(async({args,rom,bytes,dir,hash})=>{
  const r=await inspectLocalCubeCombinedTransaction(args);
  assert.deepEqual([r.cellChanges,r.warpChanges,r.eventChanges,r.connectionChanges,r.scriptChanges],[1,1,1,1,1]);
  assert.equal(r.changedBytes,5);
  assert.equal(r.combinedReDecodeVerified,true);
  assert.equal(r.rollbackVerified,true);
  assert.equal(r.sourcePreserved,true);
  assert.equal(r.ownershipConflicts,0);
  assert.ok(r.globalPointerCensus.scannedAlignedWords>0);
  assert.ok(r.globalPointerCensus.canonicalPointerCandidates>=4);
  assert.equal(r.globalPointerCensus.globalOwnershipProven,false);
  assert.equal(r.globalPointerCensus.writeAuthorized,false);
  assert.equal(r.writeAuthorized,false);
  assert.equal(r.strictParityEvidence,false);
  assert.deepEqual(await readFile(rom),Buffer.from(bytes));
  assert.equal((await readdir(dir)).length,3);
  const report=JSON.stringify(r);
  assert.ok(!report.includes(dir)&&!report.includes(hash)&&!report.includes('0x0800b000'));
 });
});
test('CLI returns aggregate-only report without leaking local ROM identity',async()=>{
 await fixture(async({args,dir,hash})=>{
  const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(r.stdout).scriptChanges,1);
  assert.ok(!r.stdout.includes(dir)&&!r.stdout.includes(hash));
 });
});
test('stale source SHA, expected edit fields and incomplete census fail closed',async()=>{
 await fixture(async({args,plan,rom,bytes})=>{
  const badHash=args.map((v,i)=>i===5?'0'.repeat(64):v);
  await assert.rejects(inspectLocalCubeCombinedTransaction(badHash),/SHA-256/);
  await writeFile(plan,JSON.stringify({...edit,cells:[{...edit.cells[0],expectedRaw:7}]}));
  await assert.rejects(inspectLocalCubeCombinedTransaction(args),/changed|stale|original/i);
  await writeFile(plan,JSON.stringify(edit));
  await assert.rejects(inspectLocalCubeCombinedTransaction(args.slice(0,-2)),/banks/i);
  assert.deepEqual(await readFile(rom),Buffer.from(bytes));
 });
});
test('invalid and oversized plans, symlink input and duplicate banks refuse safely',async()=>{
 await fixture(async({args,plan,rom,dir,bytes})=>{
  for(const bad of ['{}','{"cells":[]}','{"cells":[{}],"extra":1}',
   '{"cells":{} }',JSON.stringify({cells:Array.from({length:33},()=>({}))})]){
   await writeFile(plan,bad);
   await assert.rejects(inspectLocalCubeCombinedTransaction(args),RangeError);
  }
  await writeFile(plan,JSON.stringify(edit));
  const alias=join(dir,'alias.gba');await symlink(rom,alias);
  await assert.rejects(inspectLocalCubeCombinedTransaction(
   args.map((v,i)=>i===1?alias:v)),/non-symlink/i);
  await assert.rejects(inspectLocalCubeCombinedTransaction(
   [...args.slice(0,-1),'0:1,0:1']),RangeError);
  assert.deepEqual(await readFile(rom),Buffer.from(bytes));
 });
});
