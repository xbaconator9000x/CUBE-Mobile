import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,symlink,link,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyBps} from '../src/core.js';
import {exportLocalBpsDiff} from '../scripts/local-bps-diff.mjs';
import {publishNewPatchArtifact} from '../scripts/local-atomic-patch-artifact.mjs';

const cli=fileURLToPath(new URL('../scripts/local-bps-diff.mjs',import.meta.url));
async function fixture(run) {
  const dir=await mkdtemp(join(tmpdir(),'cube-bps-local-'));
  try {
    const rom=join(dir,'source.gba'),plan=join(dir,'edits.json'),out=join(dir,'diff.bps');
    const bytes=Buffer.alloc(4096);
    for(let i=0;i<bytes.length;i++)bytes[i]=(i*13+3)&255;
    await writeFile(rom,bytes);
    const sha=createHash('sha256').update(bytes).digest('hex');
    const edits=[{offset:8,expected:bytes[8],value:77},
      {offset:4095,expected:bytes[4095],value:12}];
    await writeFile(plan,JSON.stringify({edits}));
    const args=['--rom',rom,'--expected-sha256',sha,'--plan',plan,'--out',out];
    await run({dir,rom,plan,out,bytes,sha,args,edits});
  } finally { await rm(dir,{recursive:true,force:true}); }
}
test('local BPS export is source-bound, atomic, replayable and aggregate-only',async()=>{
  await fixture(async f=>{
    const result=await exportLocalBpsDiff(f.args);
    assert.equal(result.patchReplayVerified,true);
    assert.equal(result.destinationReopenVerified,true);
    assert.equal(result.publishedPatchReplayed,true);
    assert.equal(result.publishedTargetSha256Verified,true);
    assert.equal(result.changedBytes,2);
    assert.equal(result.semanticWritesAllowed,false);
    assert.ok(!JSON.stringify(result).includes(f.sha));
    assert.ok(!JSON.stringify(result).includes(f.dir));
    const patch=await readFile(f.out),target=applyBps(f.bytes,patch);
    assert.equal(target[8],77);
    assert.equal(target[4095],12);
    assert.deepEqual(await readFile(f.rom),f.bytes);
    assert.equal((await readdir(f.dir)).filter(x=>x.includes('.cube-patch-stage-')).length,0);
  });
});
test('local CLI returns no sensitive paths, bytes or hashes',async()=>{
  await fixture(async f=>{
    const r=spawnSync(process.execPath,[cli,...f.args],{encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
    assert.equal(JSON.parse(r.stdout).patchExported,true);
    assert.ok(!r.stdout.includes(f.sha) && !r.stdout.includes(f.dir));
    const repeat=spawnSync(process.execPath,[cli,...f.args],{encoding:'utf8'});
    assert.equal(repeat.status,2);
    assert.ok(!repeat.stderr.includes(f.dir));
  });
});
test('stale edit plan, wrong ROM hash and existing destination fail closed',async()=>{
  await fixture(async f=>{
    await assert.rejects(exportLocalBpsDiff(f.args.map(v=>v===f.sha?'0'.repeat(64):v)),/SHA-256/);
    await writeFile(f.plan,JSON.stringify({edits:[{offset:8,expected:0,value:77}]}));
    await assert.rejects(exportLocalBpsDiff(f.args),/stale/);
    await writeFile(f.plan,JSON.stringify({edits:f.edits}));
    await writeFile(f.out,Buffer.from([1,2,3]));
    await assert.rejects(exportLocalBpsDiff(f.args),/already exists/);
    assert.deepEqual(await readFile(f.out),Buffer.from([1,2,3]));
    assert.deepEqual(await readFile(f.rom),f.bytes);
  });
});
test('symlink output directory and existing symlink destination are rejected',async()=>{
  await fixture(async f=>{
    const actual=join(f.dir,'actual'),alias=join(f.dir,'alias');
    await mkdir(actual);await symlink(actual,alias);
    await assert.rejects(exportLocalBpsDiff(
      f.args.map(v=>v===f.out?join(alias,'diff.bps'):v)),/symlink/);
    await symlink(f.rom,f.out);
    await assert.rejects(exportLocalBpsDiff(f.args),/already exists/);
    assert.deepEqual(await readFile(f.rom),f.bytes);
  });
});

test('failed post-publication verifier removes only the new patch inode and its stage',async()=>{
  await fixture(async f=>{
    let called=0;
    await assert.rejects(publishNewPatchArtifact(f.out+'.rejected',Buffer.alloc(19),{
      verifyPublished:async pathname=>{
        called++;
        assert.deepEqual(await readFile(pathname),Buffer.alloc(19));
        throw new RangeError('Simulated independent replay rejection');
      }
    }),/Simulated independent replay rejection/);
    assert.equal(called,1);
    const names=await readdir(f.dir);
    assert.ok(!names.some(n=>n.includes('.cube-patch-stage-')));
    assert.ok(!names.some(n=>n.endsWith('.rejected')));
    assert.deepEqual(await readFile(f.rom),f.bytes);
  });
});

test('successful published verifier runs before the stage is removed',async()=>{
  await fixture(async f=>{
    let called=0;
    const artifact=f.out+'.verified',payload=Buffer.alloc(19,0x41);
    const result=await publishNewPatchArtifact(artifact,payload,{
      verifyPublished:async pathname=>{
        called++;
        assert.deepEqual(await readFile(pathname),payload);
        assert.ok((await readdir(f.dir)).some(n=>n.includes('.cube-patch-stage-')));
      }
    });
    assert.equal(called,1);
    assert.equal(result.publishedAcceptanceVerified,true);
    assert.deepEqual(await readFile(artifact),payload);
    assert.ok(!(await readdir(f.dir)).some(n=>n.includes('.cube-patch-stage-')));
  });
});
