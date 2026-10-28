import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseLocalCubeScriptTransactionArgs,inspectLocalCubeScriptTransaction}
 from '../scripts/local-cube-script-transaction.mjs';
function u16(b,i,v){b[i]=v&255;b[i+1]=v>>>8;}
function u32(b,i,v){u16(b,i,v&65535);u16(b,i+2,v>>>16);}
function ptr(b,i,at){u32(b,i,0x08000000+at);}
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'cube-script-transaction-'));
 try{
  const rom=join(dir,'test.gba'),metadata=join(dir,'test.toml'),plan=join(dir,'plan.json');
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
  ptr(bytes,0x204,0x600);
  bytes[0x600]=2;bytes[0x603]=1;
  ptr(bytes,0x604,0x820);ptr(bytes,0x610,0x880);
  ptr(bytes,0x820+16,0xa100);ptr(bytes,0x838+16,0xa110);
  bytes[0x880+5]=5;u32(bytes,0x880+8,0x12345678);
  await writeFile(rom,bytes);await writeFile(metadata,toml);
  const changes=[{kind:'objects',index:0,expectedRaw:0x0800a100,
   targetKind:'objects',targetIndex:1}];
  await writeFile(plan,JSON.stringify({changes}));
  const hash=createHash('sha256').update(bytes).digest('hex');
  const args=['--rom',rom,'--metadata',metadata,'--expected-sha256',hash,
   '--bank-index','0','--map-index','0','--map-count','1','--plan',plan];
  return await fn({dir,rom,metadata,plan,hash,args,bytes});
 }finally{await rm(dir,{recursive:true,force:true});}
}
const cli=fileURLToPath(new URL('../scripts/local-cube-script-transaction.mjs',import.meta.url));
test('local script transaction validates, re-decodes, rolls back and preserves ROM',async()=>{
 await fixture(async({dir,rom,args,hash})=>{
  const before=await readFile(rom),report=await inspectLocalCubeScriptTransaction(args);
  assert.equal(report.changedReferences,1);
  assert.equal(report.changedBytes,1);
  assert.equal(report.hiddenItemUnionsProtected,1);
  assert.equal(report.rollbackVerified,true);
  assert.equal(report.romExported,false);
  assert.equal(report.independentParityEvidence,false);
  assert.deepEqual(await readFile(rom),before);
  const serialized=JSON.stringify(report);
  assert.ok(!serialized.includes(dir));
  assert.ok(!serialized.includes(hash));
  assert.ok(!serialized.includes('0x0800a110'));
 });
});
test('CLI emits aggregate-only JSON without paths or ROM digests',async()=>{
 await fixture(async({dir,args,hash})=>{
  const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).changedReferences,1);
  assert.ok(!result.stdout.includes(dir));
  assert.ok(!result.stdout.includes(hash));
 });
});
test('stale ROM identity and hidden-item script edits fail closed',async()=>{
 await fixture(async({args,plan,rom,bytes,dir})=>{
  await assert.rejects(inspectLocalCubeScriptTransaction(
   args.map((v,i)=>i===5?'0'.repeat(64):v)),/SHA-256/);
  await writeFile(plan,JSON.stringify({changes:[{
   kind:'signposts',index:0,expectedRaw:0x12345678,
   targetKind:'objects',targetIndex:1}]}));
  await assert.rejects(inspectLocalCubeScriptTransaction(args),/hidden-item/i);
  const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  assert.equal(result.status,2);
  assert.ok(!result.stderr.includes(dir));
  assert.deepEqual(await readFile(rom),Buffer.from(bytes));
 });
});
test('invalid plans and malformed CLI options are rejected without file output',async()=>{
 await fixture(async({args,plan})=>{
  assert.throws(()=>parseLocalCubeScriptTransactionArgs(args.slice(0,-2)),RangeError);
  assert.throws(()=>parseLocalCubeScriptTransactionArgs([...args.slice(0,-2),
   '--rom',args[1]]),RangeError);
  for(const content of ['{}','{"changes":[]}',
   '{"changes":[{"kind":"objects","index":0,"expectedRaw":0,"targetKind":"objects","targetIndex":1,"extra":1}]}']){
   await writeFile(plan,content);
   await assert.rejects(inspectLocalCubeScriptTransaction(args),RangeError);
  }
 });
});

test('optional explicit bank census reports script-pointer ownership without exporting bytes',async()=>{
 await fixture(async({args,rom,bytes})=>{
  const report=await inspectLocalCubeScriptTransaction([...args,'--banks','0:1']);
  assert.equal(report.boundedOwnershipInspected,true);
  assert.equal(report.declaredOwnershipMaps,1);
  assert.equal(report.editedByteOwnershipConflicts,0);
  assert.equal(report.mapScriptOwnershipIssueCount,0);
  assert.equal(report.ownershipCensusIncomplete,false);
  assert.equal(report.globalPointerOwnershipProven,false);
  assert.deepEqual(await readFile(rom),Buffer.from(bytes));
 });
});
test('shared event array across declared banks is reported as an edited-byte conflict',async()=>{
 await fixture(async({args,rom,bytes})=>{
  const modified=Buffer.from(bytes);
  ptr(modified,0x14,0x120);ptr(modified,0x120,0x240);
  ptr(modified,0x240,0x280);ptr(modified,0x244,0x600);
  await writeFile(rom,modified);
  const hash=createHash('sha256').update(modified).digest('hex');
  const declared=args.map((v,i)=>i===5?hash:v).concat('--banks','0:1,1:1');
  const report=await inspectLocalCubeScriptTransaction(declared);
  assert.equal(report.declaredOwnershipMaps,2);
  assert.ok(report.editedByteOwnershipConflicts>0);
  assert.equal(report.globalPointerOwnershipProven,false);
  assert.equal(report.romExported,false);
  assert.deepEqual(await readFile(rom),modified);
 });
});
test('malformed, incomplete and duplicate bank declarations fail before touching ROM',async()=>{
 await fixture(async({args})=>{
  for(const value of ['0:0','0:129','0:1,0:1','1:1','0:1,1:256','0:1,','0:1;1:1'])
   assert.throws(()=>parseLocalCubeScriptTransactionArgs([...args,'--banks',value]),RangeError);
 });
});

test('legacy local script CLI refuses symlinked ROM, metadata and edit-plan inputs',async()=>{
 await fixture(async({args,dir,rom,metadata,plan})=>{
  for(const [position,target] of [[1,rom],[3,metadata],[13,plan]]){
   const alias=join(dir,'alias-'+position);
   await symlink(target,alias);
   const modified=args.map((v,i)=>i===position?alias:v);
   await assert.rejects(inspectLocalCubeScriptTransaction(modified),/non-symlink/i);
   const cliRun=spawnSync(process.execPath,[cli,...modified],{encoding:'utf8'});
   assert.equal(cliRun.status,2);
   assert.ok(!cliRun.stderr.includes(dir));
  }
 });
});
