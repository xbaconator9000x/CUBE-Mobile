import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildVerifiedBpsDiff} from '../src/bps-export.js';
import {applyBps} from '../src/core.js';
import {parseBpsRecoveryArgs,recoverPublishedBpsSaveAs}
 from '../scripts/local-bps-recovery.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(run){
 const dir=await mkdtemp(join(tmpdir(),'cube-recovery-replay-'));
 try{
  const source=Buffer.alloc(8192);
  for(let i=0;i<source.length;i++)source[i]=(i*11+i%13)&255;
  const patch=Buffer.from(buildVerifiedBpsDiff(source,[[0x180,0x42],[0x210,0xA5]]));
  const target=Buffer.from(applyBps(source,patch));
  const romPath=join(dir,'original.gba'),patchPath=join(dir,'change.bps'),
   destinationPath=join(dir,'saved.gba'),
   stage=join(dir,'.saved.gba.cube-rom-stage-'+'a'.repeat(24));
  await Promise.all([writeFile(romPath,source),writeFile(patchPath,patch),
   writeFile(destinationPath,target)]);
  const options={destinationPath,expectedTargetSha256:sha(target),
   sourcePath:romPath,patchPath,expectedSourceSha256:sha(source)};
  await run({dir,source,patch,target,romPath,patchPath,destinationPath,stage,options});
 }finally{await rm(dir,{recursive:true,force:true});}
}

test('recovery verifies independent source-bound BPS replay before stage cleanup',async()=>{
 await fixture(async f=>{
  await link(f.destinationPath,f.stage);
  const before=await readFile(f.romPath),patchBefore=await readFile(f.patchPath);
  const report=await recoverPublishedBpsSaveAs(f.options);
  assert.equal(report.status,'stage-link-recovered');
  assert.equal(report.bpsReplayVerified,true);
  assert.equal(report.semanticWritesAuthorized,false);
  assert.equal(report.cubeRomAuthenticated,false);
  assert.deepEqual(await readFile(f.destinationPath),f.target);
  assert.deepEqual(await readFile(f.romPath),before);
  assert.deepEqual(await readFile(f.patchPath),patchBefore);
  assert.deepEqual(await readdir(f.dir).then(x=>x.filter(n=>n.includes('stage'))),[]);
  const repeat=await recoverPublishedBpsSaveAs(f.options);
  assert.equal(repeat.status,'already-clean');
  assert.equal(repeat.bpsReplayVerified,true);
  for(const secret of [f.dir,sha(f.source),sha(f.target)])
   assert.equal(JSON.stringify(report).includes(secret),false);
 });
});

test('wrong source digest or BPS bytes refuse cleanup and preserve both links',async()=>{
 await fixture(async f=>{
  await link(f.destinationPath,f.stage);
  await assert.rejects(recoverPublishedBpsSaveAs({
   ...f.options,expectedSourceSha256:'0'.repeat(64)}),/source digest/);
  await writeFile(f.patchPath,Buffer.from(buildVerifiedBpsDiff(f.source,[[0x180,0x43]])));
  await assert.rejects(recoverPublishedBpsSaveAs(f.options),/BPS replay/);
  assert.deepEqual(await readFile(f.destinationPath),f.target);
  assert.deepEqual(await readFile(f.stage),f.target);
 });
});

test('optional replay flags are all-or-nothing and reject aliases',async()=>{
 await fixture(async f=>{
  const argv=['--out',f.destinationPath,'--expected-target-sha256',
   f.options.expectedTargetSha256,'--rom',f.romPath,'--patch',f.patchPath,
   '--expected-sha256',f.options.expectedSourceSha256];
  assert.deepEqual(parseBpsRecoveryArgs(argv),f.options);
  assert.throws(()=>parseBpsRecoveryArgs(argv.slice(0,6)),/Expected|together/);
  assert.throws(()=>parseBpsRecoveryArgs([...argv.slice(0,6),
   '--patch',f.patchPath,'--expected-sha256','invalid']),/source SHA-256/);
  assert.throws(()=>parseBpsRecoveryArgs(argv.map(v=>
   v===f.romPath?f.destinationPath:v)),/distinct/);
  await assert.rejects(recoverPublishedBpsSaveAs({
   ...f.options,patchPath:null}),/together/);
 });
});
