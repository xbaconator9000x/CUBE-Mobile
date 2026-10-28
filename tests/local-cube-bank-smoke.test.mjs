import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseLocalCubeBankSmokeArgs,inspectLocalCubeBankSmoke} from '../scripts/local-cube-bank-smoke.mjs';

const cli=fileURLToPath(new URL('../scripts/local-cube-bank-smoke.mjs',import.meta.url));
const metadata=`[[NamedAnchors]]
Name = '''data.maps.banks'''
Address = 0x10
Format = '''[maps<[map<[layout<>]1>]?>]2'''
`;
async function fixture(fn){
 const dir=await mkdtemp(join(tmpdir(),'cube-bank-smoke-'));
 try{
  const rom=join(dir,'local.gba'),toml=join(dir,'local.toml');
  const bytes=new Uint8Array(128);
  for(const [index,word] of [0x08000040,0x08000040].entries())
   for(let j=0;j<4;j++)bytes[16+index*4+j]=(word>>>(j*8))&255;
  bytes[64]=0x70;bytes[67]=0x08; // raw pointer-shaped nested word, not a map
  await writeFile(rom,bytes);await writeFile(toml,metadata);
  const hash=createHash('sha256').update(bytes).digest('hex');
  return await fn({dir,rom,toml,hash,bytes});
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('local CUBE bank smoke returns aggregate-only raw evidence with exact user hash',async()=>{
 await fixture(async({dir,rom,toml,hash,bytes})=>{
  const before=await readFile(rom);
  const report=await inspectLocalCubeBankSmoke(['--rom',rom,'--metadata',toml,'--expected-sha256',hash]);
  assert.equal(report.declaredPointerSlots,2);
  assert.equal(report.repeatedTargets,1);
  assert.equal(report.inRomPointerWords,2);
  assert.equal(report.independentlyAuthenticated,false);
  assert.equal(report.romModified,false);
  assert.equal(report.independentParityEvidence,false);
  const serialized=JSON.stringify(report);
  assert.ok(!serialized.includes(dir));
  assert.ok(!serialized.includes(hash));
  assert.ok(!serialized.includes('0x08000040'));
  assert.deepEqual(await readFile(rom),before);
  assert.deepEqual(before,Buffer.from(bytes));
 });
});
test('local CLI emits JSON and never echoes ROM paths',async()=>{
 await fixture(async({dir,rom,toml,hash})=>{
  const p=spawnSync(process.execPath,[cli,'--rom',rom,'--metadata',toml,'--expected-sha256',hash],{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  assert.equal(JSON.parse(p.stdout).declaredPointerSlots,2);
  assert.ok(!p.stdout.includes(dir));
 });
});
test('wrong SHA, invalid metadata and malformed arguments fail closed',async()=>{
 await fixture(async({dir,rom,toml,hash})=>{
  await assert.rejects(inspectLocalCubeBankSmoke(['--rom',rom,'--metadata',toml,
   '--expected-sha256','0'.repeat(64)]),RangeError);
  await writeFile(toml,'[[NamedAnchors]]\nName="other"\nAddress=0x10\nFormat="[x.]"');
  await assert.rejects(inspectLocalCubeBankSmoke(['--rom',rom,'--metadata',toml,
   '--expected-sha256',hash]),RangeError);
  assert.throws(()=>parseLocalCubeBankSmokeArgs(['--rom',rom]),RangeError);
  assert.throws(()=>parseLocalCubeBankSmokeArgs(['--rom',rom,'--rom',rom,
   '--expected-sha256',hash]),RangeError);
  const p=spawnSync(process.execPath,[cli,'--rom',rom,'--metadata',toml,
   '--expected-sha256',hash],{encoding:'utf8'});
  assert.equal(p.status,2);
  assert.ok(!p.stderr.includes(dir));
 });
});

test('optional bounded target-word census is aggregate-only and ROM-immutable',async()=>{
 await fixture(async({dir,rom,toml,hash})=>{
  const before=await readFile(rom);
  const args=['--rom',rom,'--metadata',toml,'--expected-sha256',hash,'--target-words','4'];
  const report=await inspectLocalCubeBankSmoke(args);
  assert.equal(report.schema,'cube-mobile-local-cube-bank-table-smoke/2');
  assert.equal(report.rawTargetWindowWords,4);
  assert.equal(report.rawTargetsSampled,1);
  assert.equal(report.rawTargetDuplicateSkips,1);
  assert.equal(report.rawNestedInRomPointerWords,1);
  assert.equal(report.independentlyAuthenticated,false);
  const serialized=JSON.stringify(report);
  assert.ok(!serialized.includes(dir));
  assert.ok(!serialized.includes(hash));
  assert.ok(!serialized.includes('0x08000070'));
  assert.deepEqual(await readFile(rom),before);
  const cli=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/local-cube-bank-smoke.mjs',import.meta.url)),...args],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.equal(JSON.parse(cli.stdout).rawTargetsSampled,1);
 });
});
test('optional target window arguments fail closed on unsafe counts',async()=>{
 await fixture(async({rom,toml,hash})=>{
  for(const words of ['0','17','-1','1.5','01','999']){
   const args=['--rom',rom,'--metadata',toml,'--expected-sha256',hash,'--target-words',words];
   assert.throws(()=>parseLocalCubeBankSmokeArgs(args),RangeError);
   await assert.rejects(inspectLocalCubeBankSmoke(args),RangeError);
  }
 });
});
