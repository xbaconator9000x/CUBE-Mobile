import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,symlink,link,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {saveUnmodifiedRomAs} from '../scripts/local-rom-atomic-saveas.mjs';
const cli=fileURLToPath(new URL('../scripts/local-rom-atomic-saveas.mjs',import.meta.url));
async function fixture(run){
 const dir=await mkdtemp(join(tmpdir(),'cube-atomic-saveas-'));
 try{
  const sourcePath=join(dir,'synthetic.bin'),destinationPath=join(dir,'copy.bin');
  const bytes=Buffer.alloc(8192);
  for(let i=0;i<bytes.length;i++)bytes[i]=(i*37+i%11)&255;
  await writeFile(sourcePath,bytes);
  const expectedSha256=createHash('sha256').update(bytes).digest('hex');
  return await run({dir,sourcePath,destinationPath,bytes,expectedSha256});
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('byte-identical Save As reopens and verifies without editing source',async()=>{
 await fixture(async args=>{
  const report=await saveUnmodifiedRomAs(args);
  assert.equal(report.byteCount,args.bytes.length);
  assert.equal(report.destinationReopenVerified,true);
  assert.equal(report.atomicNoOverwrite,true);
  assert.equal(report.mapChangesApplied,false);
  assert.equal(report.strictParityEvidence,false);
  assert.deepEqual(await readFile(args.sourcePath),args.bytes);
  assert.deepEqual(await readFile(args.destinationPath),args.bytes);
  assert.equal((await readdir(args.dir)).filter(x=>x.includes('.cube-stage-')).length,0);
  assert.ok(!JSON.stringify(report).includes(args.expectedSha256));
  assert.ok(!JSON.stringify(report).includes(args.dir));
 });
});
test('bad SHA and preexisting destination refuse without touching either file',async()=>{
 await fixture(async args=>{
  await assert.rejects(saveUnmodifiedRomAs({...args,expectedSha256:'0'.repeat(64)}),/SHA-256/);
  assert.deepEqual(await readdir(args.dir),['synthetic.bin']);
  await writeFile(args.destinationPath,Buffer.from([1,2,3]));
  await assert.rejects(saveUnmodifiedRomAs(args),/already exists/);
  assert.deepEqual(await readFile(args.destinationPath),Buffer.from([1,2,3]));
  assert.deepEqual(await readFile(args.sourcePath),args.bytes);
 });
});
test('symlink source and same-path Save As are rejected',async()=>{
 await fixture(async args=>{
  const alias=join(args.dir,'source-alias.bin');
  await symlink(args.sourcePath,alias);
  await assert.rejects(saveUnmodifiedRomAs({...args,sourcePath:alias}),/regular file|symlink/);
  await assert.rejects(saveUnmodifiedRomAs({...args,destinationPath:args.sourcePath}),/must differ/);
  assert.deepEqual((await readdir(args.dir)).sort(),['source-alias.bin','synthetic.bin']);
 });
});
test('local CLI returns aggregate-only report and refuses existing destination',async()=>{
 await fixture(async args=>{
  const flags=['--source',args.sourcePath,'--destination',args.destinationPath,
   '--expected-sha256',args.expectedSha256];
  const first=spawnSync(process.execPath,[cli,...flags],{encoding:'utf8'});
  assert.equal(first.status,0,first.stderr);
  assert.equal(JSON.parse(first.stdout).destinationReopenVerified,true);
  assert.ok(!first.stdout.includes(args.dir));
  assert.ok(!first.stdout.includes(args.expectedSha256));
  const second=spawnSync(process.execPath,[cli,...flags],{encoding:'utf8'});
  assert.equal(second.status,2);
  assert.ok(!second.stderr.includes(args.dir));
  assert.deepEqual(await readFile(args.destinationPath),args.bytes);
 });
});

test('preexisting hardlink and symlink destinations are never overwritten',async()=>{
 await fixture(async args=>{
  await link(args.sourcePath,args.destinationPath);
  await assert.rejects(saveUnmodifiedRomAs(args),/already exists/);
  assert.deepEqual(await readFile(args.destinationPath),args.bytes);
  assert.deepEqual(await readFile(args.sourcePath),args.bytes);
 });
 await fixture(async args=>{
  await symlink(args.sourcePath,args.destinationPath);
  await assert.rejects(saveUnmodifiedRomAs(args),/already exists/);
  assert.deepEqual(await readFile(args.sourcePath),args.bytes);
 });
});
test('destination directory symlink traversal fails closed before staging',async()=>{
 await fixture(async args=>{
  const actual=join(args.dir,'actual'),alias=join(args.dir,'alias');
  await mkdir(actual);await symlink(actual,alias);
  await assert.rejects(saveUnmodifiedRomAs({
   ...args,destinationPath:join(alias,'copy.bin')
  }),/symlink/);
  assert.deepEqual(await readdir(actual),[]);
  assert.deepEqual(await readFile(args.sourcePath),args.bytes);
 });
});

test('Save As refuses a symlinked source directory before creating output',async()=>{
 await fixture(async args=>{
  const actual=join(args.dir,'actual'),alias=join(args.dir,'alias');
  await mkdir(actual);
  const source=join(actual,'source.bin');
  await writeFile(source,args.bytes);
  await symlink(actual,alias);
  await assert.rejects(saveUnmodifiedRomAs({
   ...args,sourcePath:join(alias,'source.bin')
  }),/symlink/i);
  assert.deepEqual(await readdir(args.dir),['actual','alias','synthetic.bin']);
  assert.deepEqual(await readFile(source),args.bytes);
 });
});
