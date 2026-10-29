import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,link,symlink,chmod,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildVerifiedBpsDiff} from '../src/bps-export.js';
import {applyBps} from '../src/core.js';
import {parseOrphanBpsRecoveryArgs,recoverUnpublishedBpsSaveAs}
 from '../scripts/local-bps-orphan-recovery.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const cli=fileURLToPath(new URL('../scripts/local-bps-orphan-recovery.mjs',import.meta.url));
async function fixture(run){
 const dir=await mkdtemp(join(tmpdir(),'cube-bps-orphan-'));
 try{
  const source=Buffer.alloc(8192);
  for(let i=0;i<source.length;i++)source[i]=(i*13+i%7)&255;
  const patch=Buffer.from(buildVerifiedBpsDiff(source,[[0x180,0x44],[0x212,0xA5]]));
  const target=Buffer.from(applyBps(source,patch));
  const sourcePath=join(dir,'source.gba'),patchPath=join(dir,'patch.bps'),
   destinationPath=join(dir,'result.gba'),
   stage=join(dir,'.result.gba.cube-rom-stage-'+'a'.repeat(24));
  await Promise.all([writeFile(sourcePath,source),writeFile(patchPath,patch),
   writeFile(stage,target,{mode:0o600})]);
  const options={sourcePath,patchPath,destinationPath,
   expectedSourceSha256:digest(source),expectedTargetSha256:digest(target)};
  await run({dir,source,patch,target,stage,options,sourcePath,patchPath,destinationPath});
 }finally{
  await chmod(dir,0o700).catch(()=>{});
  await rm(dir,{recursive:true,force:true});
 }
}
test('publishes a verified orphan with no overwrite, exact reopen and input preservation',async()=>{
 await fixture(async f=>{
  const result=await recoverUnpublishedBpsSaveAs(f.options);
  assert.equal(result.status,'orphan-published');
  assert.equal(result.bpsReplayVerified,true);
  assert.equal(result.publishedRomReopened,true);
  assert.equal(result.semanticWritesAuthorized,false);
  assert.equal(result.strictParityEvidence,false);
  assert.deepEqual(await readFile(f.destinationPath),f.target);
  assert.deepEqual(await readFile(f.sourcePath),f.source);
  assert.deepEqual(await readFile(f.patchPath),f.patch);
  assert.equal((await readdir(f.dir)).some(n=>n.includes('stage-')),false);
  assert.equal((await lstat(f.destinationPath)).nlink,1);
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/already exists/);
 });
});
test('refuses incorrect source or target assertions without publishing or deleting stage',async()=>{
 await fixture(async f=>{
  await assert.rejects(recoverUnpublishedBpsSaveAs({
   ...f.options,expectedSourceSha256:'0'.repeat(64)}),/Source ROM/);
  await assert.rejects(recoverUnpublishedBpsSaveAs({
   ...f.options,expectedTargetSha256:'0'.repeat(64)}),/BPS replay/);
  assert.deepEqual(await readFile(f.stage),f.target);
  await assert.rejects(readFile(f.destinationPath),{code:'ENOENT'});
 });
});
test('rejects ambiguous, foreign-linked, symlink and modified stages',async()=>{
 await fixture(async f=>{
  const another=join(f.dir,'.result.gba.cube-rom-stage-'+'b'.repeat(24));
  await writeFile(another,f.target,{mode:0o600});
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/Exactly one/);
  await rm(another);
  const foreign=join(f.dir,'foreign.gba');
  await link(f.stage,foreign);
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/single-link/);
  await rm(foreign);
  await rm(f.stage);
  await symlink(f.sourcePath,f.stage);
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/single-link/);
  await rm(f.stage);
  await writeFile(f.stage,Buffer.alloc(f.target.length,0xFF),{mode:0o600});
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/Staged bytes/);
  await assert.rejects(readFile(f.destinationPath),{code:'ENOENT'});
 });
});
test('never overwrites an existing destination, even when it contains identical bytes',async()=>{
 await fixture(async f=>{
  await writeFile(f.destinationPath,f.target);
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/already exists/);
  assert.deepEqual(await readFile(f.destinationPath),f.target);
  assert.deepEqual(await readFile(f.stage),f.target);
 });
});
test('rejects public stage permissions, public directory and malformed stage names',async()=>{
 await fixture(async f=>{
  await chmod(f.stage,0o644);
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/private, owner-controlled/);
  await chmod(f.stage,0o600);
  await chmod(f.dir,0o777);
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/private owner-controlled/);
  await chmod(f.dir,0o700);
  await rm(f.stage);
  await writeFile(join(f.dir,'.result.gba.cube-rom-stage-not-a-token'),f.target,{mode:0o600});
  await assert.rejects(recoverUnpublishedBpsSaveAs(f.options),/Exactly one/);
 });
});
test('CLI argument parser is strict, and CLI redacts private file names and hashes',async()=>{
 await fixture(async f=>{
  const argv=['--rom',f.sourcePath,'--patch',f.patchPath,'--out',f.destinationPath,
   '--expected-sha256',f.options.expectedSourceSha256,
   '--expected-target-sha256',f.options.expectedTargetSha256];
  assert.deepEqual(parseOrphanBpsRecoveryArgs(argv),f.options);
  assert.throws(()=>parseOrphanBpsRecoveryArgs(argv.slice(0,8)),RangeError);
  assert.throws(()=>parseOrphanBpsRecoveryArgs([...argv.slice(0,8),
   '--expected-sha256',f.options.expectedSourceSha256]),RangeError);
  const run=spawnSync(process.execPath,[cli,...argv],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.equal(JSON.parse(run.stdout).status,'orphan-published');
  for(const secret of [f.dir,f.options.expectedSourceSha256,f.options.expectedTargetSha256])
   assert.equal(run.stdout.includes(secret),false);
  const repeat=spawnSync(process.execPath,[cli,...argv],{encoding:'utf8'});
  assert.equal(repeat.status,2);
  assert.equal(repeat.stderr.includes(f.dir),false);
 });
});
