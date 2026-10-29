import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,symlink,link,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildVerifiedBpsDiff} from '../src/bps-export.js';
import {exportLocalBpsDiff} from '../scripts/local-bps-diff.mjs';
import {parseLocalBpsSaveAsArgs,saveLocalBpsTargetAs} from '../scripts/local-bps-apply-saveas.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const cli=fileURLToPath(new URL('../scripts/local-bps-apply-saveas.mjs',import.meta.url));
async function fixture(run){
 const dir=await mkdtemp(join(tmpdir(),'cube-bps-rom-saveas-'));
 try{
  const rom=join(dir,'owned.gba'),patch=join(dir,'change.bps'),out=join(dir,'target.gba');
  const source=Buffer.alloc(8192);
  for(let i=0;i<source.length;i++)source[i]=(i*19+(i>>>7))&255;
  const target=Buffer.from(source);
  target[0]=91;target[4096]=117;target[8191]=23;
  const bps=buildVerifiedBpsDiff(source,[[0,91],[4096,117],[8191,23]]);
  await writeFile(rom,source);await writeFile(patch,bps);
  const sourceHash=digest(source),targetHash=digest(target);
  const args=['--rom',rom,'--patch',patch,'--out',out,
   '--expected-sha256',sourceHash,'--expected-target-sha256',targetHash];
  await run({dir,rom,patch,out,source,bps,target,sourceHash,targetHash,args});
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('local BPS target Save As publishes exact replay and preserves source and patch',async()=>{
 await fixture(async f=>{
  const report=await saveLocalBpsTargetAs(f.args);
  assert.equal(report.exactTargetSha256Matched,true);
  assert.equal(report.destinationReopenVerified,true);
  assert.equal(report.atomicNoOverwrite,true);
  assert.equal(report.newRomCopyPublished,true);
  assert.equal(report.semanticWritesAuthorized,false);
  assert.equal(report.strictParityEvidence,false);
  assert.deepEqual(await readFile(f.out),f.target);
  assert.deepEqual(await readFile(f.rom),f.source);
  assert.deepEqual(await readFile(f.patch),Buffer.from(f.bps));
  assert.deepEqual((await readdir(f.dir)).sort(),['change.bps','owned.gba','target.gba']);
  assert.ok(!JSON.stringify(report).includes(f.dir));
  assert.ok(!JSON.stringify(report).includes(f.sourceHash));
  assert.ok(!JSON.stringify(report).includes(f.targetHash));
 });
});
test('incorrect source or target digest refuses without publishing a ROM',async()=>{
 await fixture(async f=>{
  const bad='0'.repeat(64);
  await assert.rejects(saveLocalBpsTargetAs(f.args.map(v=>v===f.sourceHash?bad:v)),/source/i);
  await assert.rejects(saveLocalBpsTargetAs(f.args.map(v=>v===f.targetHash?bad:v)),/target/i);
  assert.deepEqual((await readdir(f.dir)).sort(),['change.bps','owned.gba']);
  assert.deepEqual(await readFile(f.rom),f.source);
 });
});
test('tampered BPS CRC and wrong-base patches fail before destination creation',async()=>{
 await fixture(async f=>{
  const corrupt=Buffer.from(f.bps);corrupt[corrupt.length-13]^=1;
  await writeFile(f.patch,corrupt);
  await assert.rejects(saveLocalBpsTargetAs(f.args),/CRC/i);
  const other=Buffer.from(f.source);other[42]^=1;
  await writeFile(f.rom,other);
  await writeFile(f.patch,f.bps);
  await assert.rejects(saveLocalBpsTargetAs(
   f.args.map(v=>v===f.sourceHash?digest(other):v)),/CRC/i);
  assert.deepEqual((await readdir(f.dir)).sort(),['change.bps','owned.gba']);
 });
});
test('existing destination, symlink and hardlink are never overwritten',async()=>{
 await fixture(async f=>{
  const sentinel=Buffer.from([1,2,3,4]);
  await writeFile(f.out,sentinel);
  await assert.rejects(saveLocalBpsTargetAs(f.args),/already exists/);
  assert.deepEqual(await readFile(f.out),sentinel);
  assert.deepEqual(await readFile(f.rom),f.source);
 });
 await fixture(async f=>{
  await symlink(f.rom,f.out);
  await assert.rejects(saveLocalBpsTargetAs(f.args),/already exists/);
  assert.deepEqual(await readFile(f.rom),f.source);
 });
 await fixture(async f=>{
  await link(f.rom,f.out);
  await assert.rejects(saveLocalBpsTargetAs(f.args),/already exists/);
  assert.deepEqual(await readFile(f.rom),f.source);
 });
});
test('symlinked ROM, patch and output directory fail closed',async()=>{
 await fixture(async f=>{
  const alias=join(f.dir,'rom-alias.gba');
  await symlink(f.rom,alias);
  await assert.rejects(saveLocalBpsTargetAs(
   f.args.map(v=>v===f.rom?alias:v)),/symlink/i);
  const patchAlias=join(f.dir,'patch-alias.bps');
  await symlink(f.patch,patchAlias);
  await assert.rejects(saveLocalBpsTargetAs(
   f.args.map(v=>v===f.patch?patchAlias:v)),/symlink/i);
  const actual=join(f.dir,'actual'),directoryAlias=join(f.dir,'dir-alias');
  await mkdir(actual);await symlink(actual,directoryAlias);
  await assert.rejects(saveLocalBpsTargetAs(
   f.args.map(v=>v===f.out?join(directoryAlias,'target.gba'):v)),/symlink/i);
  assert.deepEqual(await readdir(actual),[]);
 });
});
test('invalid flags, duplicate inputs and output alias are rejected',async()=>{
 await fixture(async f=>{
  for(const args of [[],f.args.slice(0,8),
   [...f.args.slice(0,8),'--rom',f.rom],
   f.args.map(v=>v===f.out?f.rom:v),
   f.args.map(v=>v===f.patch?f.rom:v),
   f.args.map(v=>v===f.sourceHash?'bad':v)]){
   assert.throws(()=>parseLocalBpsSaveAsArgs(args),RangeError);
  }
  assert.deepEqual((await readdir(f.dir)).sort(),['change.bps','owned.gba']);
 });
});
test('CLI reports only aggregate acceptance and generically refuses a second Save As',async()=>{
 await fixture(async f=>{
  const first=spawnSync(process.execPath,[cli,...f.args],{encoding:'utf8'});
  assert.equal(first.status,0,first.stderr);
  assert.equal(JSON.parse(first.stdout).destinationReopenVerified,true);
  assert.ok(!first.stdout.includes(f.dir)&&!first.stdout.includes(f.sourceHash));
  const second=spawnSync(process.execPath,[cli,...f.args],{encoding:'utf8'});
  assert.equal(second.status,2);
  assert.ok(!second.stderr.includes(f.dir)&&!second.stderr.includes(f.targetHash));
  assert.deepEqual(await readFile(f.out),f.target);
  assert.deepEqual(await readFile(f.rom),f.source);
 });
});

test('complete local expected-byte plan -> published BPS -> verified target ROM copy',async()=>{
 await fixture(async f=>{
  await rm(f.patch);
  const plan=join(f.dir,'explicit-edits.json');
  await writeFile(plan,JSON.stringify({edits:[
   {offset:0,expected:f.source[0],value:91},
   {offset:4096,expected:f.source[4096],value:117},
   {offset:8191,expected:f.source[8191],value:23}
  ]}));
  const exported=await exportLocalBpsDiff([
   '--rom',f.rom,'--expected-sha256',f.sourceHash,
   '--plan',plan,'--out',f.patch
  ]);
  assert.equal(exported.publishedPatchReplayed,true);
  const saved=await saveLocalBpsTargetAs(f.args);
  assert.equal(saved.destinationReopenVerified,true);
  assert.deepEqual(await readFile(f.out),f.target);
  assert.deepEqual(await readFile(f.rom),f.source);
  assert.deepEqual(await readFile(f.patch),Buffer.from(f.bps));
 });
});
