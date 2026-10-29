import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {exportLocalBpsDiff} from '../scripts/local-bps-diff.mjs';
import {parseLocalBpsVerifyArgs,verifyLocalBpsPatch} from '../scripts/local-bps-verify.mjs';
import {buildVerifiedBpsDiff} from '../src/bps-export.js';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const cli=fileURLToPath(new URL('../scripts/local-bps-verify.mjs',import.meta.url));
async function fixture(run) {
  const dir=await mkdtemp(join(tmpdir(),'cube-bps-accept-'));
  try {
    const rom=join(dir,'owned.gba'),patch=join(dir,'change.bps'),plan=join(dir,'plan.json');
    const source=Buffer.alloc(4096);
    for(let i=0;i<source.length;i++)source[i]=(i*17+11)&255;
    const target=Buffer.from(source), edits=[];
    for(const [offset,value] of [[0,99],[255,34],[4095,1]]) {
      edits.push({offset,expected:source[offset],value});
      target[offset]=value;
    }
    await writeFile(rom,source);
    await writeFile(plan,JSON.stringify({edits}));
    const sourceHash=digest(source),targetHash=digest(target);
    await exportLocalBpsDiff(['--rom',rom,'--expected-sha256',sourceHash,
      '--plan',plan,'--out',patch]);
    const args=['--rom',rom,'--patch',patch,
      '--expected-sha256',sourceHash,'--expected-target-sha256',targetHash];
    await run({dir,rom,patch,plan,source,target,sourceHash,targetHash,args});
  } finally { await rm(dir,{recursive:true,force:true}); }
}

test('exported local BPS is independently reopened, replayed and exact-target verified',async()=>{
  await fixture(async f=>{
    const before=await readdir(f.dir),result=await verifyLocalBpsPatch(f.args);
    assert.equal(result.changedBytes,3);
    assert.equal(result.exactTargetSha256Matched,true);
    assert.equal(result.sourceReopenVerified,true);
    assert.equal(result.patchReopenVerified,true);
    assert.equal(result.semanticWritesAllowed,false);
    assert.equal(result.strictParityEvidence,false);
    assert.ok(!JSON.stringify(result).includes(f.dir));
    assert.ok(!JSON.stringify(result).includes(f.sourceHash));
    assert.deepEqual(await readFile(f.rom),f.source);
    assert.deepEqual(await readdir(f.dir),before);
  });
});
test('wrong source and target identities fail closed without modifying inputs',async()=>{
  await fixture(async f=>{
    const wrong='0'.repeat(64);
    await assert.rejects(verifyLocalBpsPatch(f.args.map(v=>v===f.targetHash?wrong:v)),
      /target/i);
    await assert.rejects(verifyLocalBpsPatch(f.args.map(v=>v===f.sourceHash?wrong:v)),
      /source/i);
    const original=await readFile(f.patch);
    const broken=Buffer.from(original);broken[broken.length-13]^=1;
    await writeFile(f.patch,broken);
    await assert.rejects(verifyLocalBpsPatch(f.args),/CRC/i);
    assert.deepEqual(await readFile(f.rom),f.source);
  });
});
test('BPS acceptance refuses symlinked source or patch and malformed flags',async()=>{
  await fixture(async f=>{
    const alias=join(f.dir,'alias.bps');await symlink(f.patch,alias);
    await assert.rejects(verifyLocalBpsPatch(f.args.map(v=>v===f.patch?alias:v)),
      /symlink/i);
    for(const invalid of [[],f.args.slice(0,6),
      [...f.args.slice(0,6),'--expected-sha256',f.sourceHash],
      f.args.map(v=>v===f.patch?f.rom:v)]) {
      assert.throws(()=>parseLocalBpsVerifyArgs(invalid),RangeError);
    }
  });
});
test('CLI reports only aggregate evidence and returns a generic failure',async()=>{
  await fixture(async f=>{
    const good=spawnSync(process.execPath,[cli,...f.args],{encoding:'utf8'});
    assert.equal(good.status,0,good.stderr);
    assert.equal(JSON.parse(good.stdout).readOnly,true);
    assert.ok(!good.stdout.includes(f.dir)&&!good.stdout.includes(f.sourceHash));
    const bad=spawnSync(process.execPath,[cli,...f.args.map(v=>
      v===f.targetHash?'0'.repeat(64):v)],{encoding:'utf8'});
    assert.equal(bad.status,2);
    assert.ok(!bad.stderr.includes(f.dir)&&!bad.stderr.includes(f.targetHash));
    assert.deepEqual(await readFile(f.rom),f.source);
  });
});
test('external BPS with a wrong base fails source CRC even if supplied hash matches',async()=>{
  await fixture(async f=>{
    const other=Buffer.from(f.source);other[10]^=1;
    const otherPath=join(f.dir,'other.gba');await writeFile(otherPath,other);
    await assert.rejects(verifyLocalBpsPatch(f.args.map(v=>
      v===f.rom?otherPath:v===f.sourceHash?digest(other):v)),/CRC/i);
  });
});
