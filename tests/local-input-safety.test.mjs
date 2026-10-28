import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readStableLocalFile} from '../scripts/local-input-safety.mjs';

test('shared local input boundary reads bounded regular bytes and refuses symlinks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cube-safe-input-'));
 try{
  const path=join(dir,'input.bin'),alias=join(dir,'alias.bin');
  const bytes=Buffer.from([0,1,2,3,4]);
  await writeFile(path,bytes);
  assert.deepEqual(await readStableLocalFile(path,5),bytes);
  await assert.rejects(readStableLocalFile(path,4),/bounded/i);
  await symlink(path,alias);
  await assert.rejects(readStableLocalFile(alias,5),/non-symlink/i);
  await assert.rejects(readStableLocalFile(path,0),/invalid bounded/i);
 }finally{await rm(dir,{recursive:true,force:true});}
});
