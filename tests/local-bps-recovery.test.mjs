import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,link,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseBpsRecoveryArgs,recoverPublishedBpsSaveAs}
  from '../scripts/local-bps-recovery.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const cli=fileURLToPath(new URL('../scripts/local-bps-recovery.mjs',import.meta.url));
const suffix='0123456789abcdef01234567';
async function fixture(run){
  const dir=await mkdtemp(join(tmpdir(),'cube-bps-recovery-'));
  try{
    const out=join(dir,'saved.gba');
    const target=Buffer.alloc(8192);
    for(let i=0;i<target.length;i++)target[i]=(i*37+(i>>>3))&255;
    await writeFile(out,target);
    const stage=join(dir,'.saved.gba.cube-rom-stage-'+suffix);
    const expectedTargetSha256=sha(target);
    await run({dir,out,stage,target,expectedTargetSha256,
      options:{destinationPath:out,expectedTargetSha256}});
  }finally{
    await chmod(dir,0o700).catch(()=>{});
    await rm(dir,{recursive:true,force:true});
  }
}
test('independent exact target reopen is read-only when no stage exists',async()=>{
  await fixture(async f=>{
    const result=await recoverPublishedBpsSaveAs(f.options);
    assert.equal(result.status,'already-clean');
    assert.equal(result.publishedRomReopened,true);
    assert.equal(result.recoveredStageLink,false);
    assert.equal(result.semanticWritesAuthorized,false);
    assert.deepEqual(await readFile(f.out),f.target);
    assert.deepEqual(await readdir(f.dir),['saved.gba']);
    assert.ok(Object.isFrozen(result));
    assert.ok(!JSON.stringify(result).includes(f.dir));
    assert.ok(!JSON.stringify(result).includes(f.expectedTargetSha256));
  });
});
test('recover an interrupted post-publication hardlink without touching the ROM',async()=>{
  await fixture(async f=>{
    await link(f.out,f.stage);
    const result=await recoverPublishedBpsSaveAs(f.options);
    assert.equal(result.status,'stage-link-recovered');
    assert.equal(result.recoveredStageLink,true);
    assert.equal(result.publishedRomPreserved,true);
    assert.deepEqual(await readdir(f.dir),['saved.gba']);
    assert.deepEqual(await readFile(f.out),f.target);
    const repeat=await recoverPublishedBpsSaveAs(f.options);
    assert.equal(repeat.status,'already-clean');
  });
});
test('wrong exact digest cannot delete a stage or accept altered ROM bytes',async()=>{
  await fixture(async f=>{
    await link(f.out,f.stage);
    await assert.rejects(recoverPublishedBpsSaveAs({
      ...f.options,expectedTargetSha256:'0'.repeat(64)}),/digest/);
    assert.deepEqual((await readdir(f.dir)).sort(),
      ['.saved.gba.cube-rom-stage-'+suffix,'saved.gba']);
    assert.deepEqual(await readFile(f.out),f.target);
  });
});
test('unrelated stage inode and symlink stage fail closed without deletion',async()=>{
  await fixture(async f=>{
    await writeFile(f.stage,f.target);
    await assert.rejects(recoverPublishedBpsSaveAs(f.options),/Unrelated/);
    assert.deepEqual(await readFile(f.stage),f.target);
    assert.deepEqual(await readFile(f.out),f.target);
  });
  await fixture(async f=>{
    await symlink(f.out,f.stage);
    await assert.rejects(recoverPublishedBpsSaveAs(f.options),/Unsafe staged/);
    assert.deepEqual(await readFile(f.out),f.target);
  });
});
test('multiple stages and extra external hardlinks never trigger destructive cleanup',async()=>{
  await fixture(async f=>{
    const another=join(f.dir,'.saved.gba.cube-rom-stage-'+'f'.repeat(24));
    await link(f.out,f.stage);
    await link(f.out,another);
    await assert.rejects(recoverPublishedBpsSaveAs(f.options),/Ambiguous/);
    assert.deepEqual(await readFile(f.out),f.target);
    assert.equal((await readdir(f.dir)).length,3);
  });
  await fixture(async f=>{
    await link(f.out,f.stage);
    const extra=join(f.dir,'external.gba');
    await link(f.out,extra);
    await assert.rejects(recoverPublishedBpsSaveAs(f.options),/hardlink ownership/);
    assert.deepEqual(await readFile(f.out),f.target);
    assert.deepEqual(await readFile(extra),f.target);
  });
});
test('symlinked output and nonprivate directory are rejected',async()=>{
  await fixture(async f=>{
    const alias=join(f.dir,'alias.gba');
    await symlink(f.out,alias);
    await assert.rejects(recoverPublishedBpsSaveAs({
      ...f.options,destinationPath:alias}),/symlink/i);
    assert.deepEqual(await readFile(f.out),f.target);
  });
  await fixture(async f=>{
    await link(f.out,f.stage);
    await chmod(f.dir,0o777);
    await assert.rejects(recoverPublishedBpsSaveAs(f.options),/private owner-controlled/);
    assert.deepEqual(await readFile(f.out),f.target);
    assert.equal((await readdir(f.dir)).length,2);
  });
});
test('missing published destination never deletes a pre-publication orphan',async()=>{
  await fixture(async f=>{
    await rm(f.out);
    await writeFile(f.stage,f.target);
    await assert.rejects(recoverPublishedBpsSaveAs(f.options));
    assert.deepEqual(await readFile(f.stage),f.target);
  });
});
test('invalid CLI flags, missing digest and malformed requests are refused',async()=>{
  await fixture(async f=>{
    const args=['--out',f.out,'--expected-target-sha256',f.expectedTargetSha256];
    assert.deepEqual(parseBpsRecoveryArgs(args),f.options);
    for(const invalid of [[],args.slice(0,2),
      ['--out',f.out,'--out',f.out],
      ['--out',f.out,'--expected-target-sha256','bad']])
      assert.throws(()=>parseBpsRecoveryArgs(invalid),RangeError);
    await assert.rejects(recoverPublishedBpsSaveAs({destinationPath:f.out,
      expectedTargetSha256:'bad'}),RangeError);
  });
});
test('CLI reports only aggregate recovery and redacts private paths and hashes',async()=>{
  await fixture(async f=>{
    await link(f.out,f.stage);
    const args=['--out',f.out,'--expected-target-sha256',f.expectedTargetSha256];
    const run=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    assert.equal(JSON.parse(run.stdout).status,'stage-link-recovered');
    assert.ok(!run.stdout.includes(f.out));
    assert.ok(!run.stdout.includes(f.expectedTargetSha256));
    const again=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    assert.equal(again.status,0,again.stderr);
    assert.equal(JSON.parse(again.stdout).status,'already-clean');
    const bad=spawnSync(process.execPath,[cli,...args.slice(0,3),'0'.repeat(64)],
      {encoding:'utf8'});
    assert.equal(bad.status,2);
    assert.ok(!bad.stderr.includes(f.out));
    assert.deepEqual(await readFile(f.out),f.target);
  });
});
