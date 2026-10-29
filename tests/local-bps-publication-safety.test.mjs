import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm,link,symlink,chmod,lstat,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertPrivateBpsDirectory,finishOwnedBpsPublication,
 rollbackOwnedBpsPublication} from '../scripts/local-bps-publication-safety.mjs';

async function fixture(run){
 const parent=await mkdtemp(join(tmpdir(),'cube-bps-private-'));
 const stage=join(parent,'.new.gba.cube-rom-stage-0123456789abcdef01234567');
 const destination=join(parent,'new.gba');
 const target=Buffer.alloc(4096,0x42);
 try{
  const parentIdentity=await assertPrivateBpsDirectory(parent);
  await run({parent,stage,destination,target,parentIdentity});
 }finally{
  await chmod(parent,0o700).catch(()=>{});
  await rm(parent,{recursive:true,force:true});
 }
}
test('private directory remains the same inode despite adding entries',async()=>{
 await fixture(async f=>{
  await writeFile(f.stage,f.target);
  const identity=await assertPrivateBpsDirectory(f.parent,f.parentIdentity);
  assert.equal(identity.ino,f.parentIdentity.ino);
 });
});
test('private output directory refuses group/world writes and symlink traversal',async()=>{
 await fixture(async f=>{
  await chmod(f.parent,0o770);
  await assert.rejects(assertPrivateBpsDirectory(f.parent),/private owner-controlled/);
  await chmod(f.parent,0o700);
  const alias=join(f.parent,'alias');
  await symlink(f.parent,alias);
  await assert.rejects(assertPrivateBpsDirectory(alias),/Symlinked/);
 });
});
test('successful two-link publication unlinks only stage and keeps exact destination',async()=>{
 await fixture(async f=>{
  await writeFile(f.stage,f.target);
  const identity=await lstat(f.stage);
  await link(f.stage,f.destination);
  await finishOwnedBpsPublication({...f,identity});
  assert.deepEqual(await readdir(f.parent),['new.gba']);
  assert.deepEqual(await readFile(f.destination),f.target);
  assert.equal((await lstat(f.destination)).nlink,1);
 });
});
test('prepublication rollback removes only owned single-link staging file',async()=>{
 await fixture(async f=>{
  await writeFile(f.stage,f.target);
  const identity=await lstat(f.stage);
  assert.equal(await rollbackOwnedBpsPublication({...f,identity,published:false}),true);
  assert.deepEqual(await readdir(f.parent),[]);
 });
});
test('postpublication rollback removes exactly two owned hardlinks',async()=>{
 await fixture(async f=>{
  await writeFile(f.stage,f.target);
  const identity=await lstat(f.stage);
  await link(f.stage,f.destination);
  assert.equal(await rollbackOwnedBpsPublication({...f,identity,published:true}),true);
  assert.deepEqual(await readdir(f.parent),[]);
 });
});
test('foreign stage pathname is never removed, even if it contains identical bytes',async()=>{
 await fixture(async f=>{
  await writeFile(f.stage,f.target);
  const identity=await lstat(f.stage);
  await rename(f.stage,join(f.parent,'original-stage'));
  await writeFile(f.stage,f.target);
  await assert.rejects(rollbackOwnedBpsPublication({...f,identity,published:false}),/staging pathname changed/);
  assert.deepEqual(await readFile(f.stage),f.target);
 });
});
test('foreign destination pathname cannot be rolled back or finalized',async()=>{
 await fixture(async f=>{
  await writeFile(f.stage,f.target);
  const identity=await lstat(f.stage);
  await writeFile(f.destination,f.target);
  await assert.rejects(rollbackOwnedBpsPublication({...f,identity,published:true}),/ownership changed/);
  await assert.rejects(finishOwnedBpsPublication({...f,identity}),/ownership changed/);
  assert.deepEqual(await readFile(f.destination),f.target);
  assert.deepEqual(await readFile(f.stage),f.target);
 });
});
test('extra hardlinks block cleanup without deleting any pathname',async()=>{
 await fixture(async f=>{
  await writeFile(f.stage,f.target);
  const identity=await lstat(f.stage);
  await link(f.stage,f.destination);
  const third=join(f.parent,'third.gba');
  await link(f.stage,third);
  await assert.rejects(finishOwnedBpsPublication({...f,identity}),/ownership changed/);
  await assert.rejects(rollbackOwnedBpsPublication({...f,identity,published:true}),/ownership changed/);
  assert.equal((await readdir(f.parent)).length,3);
  assert.deepEqual(await readFile(third),f.target);
 });
});
test('missing stage after publication requires manual review, not deletion of ROM',async()=>{
 await fixture(async f=>{
  await writeFile(f.destination,f.target);
  const identity=await lstat(f.destination);
  await assert.rejects(rollbackOwnedBpsPublication({...f,identity,published:true}),/staging pathname changed/);
  assert.deepEqual(await readFile(f.destination),f.target);
 });
});
