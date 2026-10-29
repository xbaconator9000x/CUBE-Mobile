/**
 * Fail-closed, inode-scoped cleanup for local BPS Save As.
 * Only private, owner-controlled directories are eligible for publication.
 * No caller-owned ROM or foreign pathname is unlinked by these helpers.
 */
import {lstat,realpath,unlink,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';

const same=(a,b)=>a&&b&&a.dev===b.dev&&a.ino===b.ino&&a.size===b.size;
async function optionalStat(path){
 try{return await lstat(path);}catch(error){if(error?.code==='ENOENT')return null;throw error;}
}
function regularOwned(stat,identity){
 return !!stat&&stat.isFile()&&!stat.isSymbolicLink()&&same(stat,identity);
}
export async function assertPrivateBpsDirectory(path,identity=null){
 const parent=resolve(path);
 if(await realpath(parent)!==parent)throw new RangeError('Symlinked output directory refused');
 const stat=await lstat(parent);
 if(!stat.isDirectory()||(stat.mode&0o022)!==0||
    (typeof process.getuid==='function'&&stat.uid!==process.getuid()))
  throw new RangeError('BPS Save As requires a private owner-controlled output directory');
 if(identity&&!same(stat,identity))
  throw new RangeError('BPS Save As output directory changed identity');
 return stat;
}
export async function syncBpsDirectory(parent){
 const handle=await open(parent,constants.O_RDONLY);
 try{await handle.sync();}finally{await handle.close();}
}
/**
 * A successful publication is a two-name hardlink transaction until the
 * stage is removed. Reject external links and pathname substitution.
 */
export async function finishOwnedBpsPublication({parent,stage,destination,identity,parentIdentity}){
 await assertPrivateBpsDirectory(parent,parentIdentity);
 const staged=await optionalStat(stage),published=await optionalStat(destination);
 if(!regularOwned(staged,identity)||!regularOwned(published,identity)||
    !same(staged,published)||staged.nlink!==2||published.nlink!==2)
  throw new RangeError('Published BPS stage ownership changed; manual recovery required');
 await syncBpsDirectory(parent); // Persist the destination link before stage removal.
 await unlink(stage);
 const after=await optionalStat(destination);
 if(!regularOwned(after,identity)||after.nlink!==1)
  throw new RangeError('Published BPS ROM identity changed after stage cleanup');
 await syncBpsDirectory(parent); // Persist stage removal.
}
/**
 * On failure, roll back ONLY the exact two-link publication that this run
 * created. If ownership cannot be established, leave everything for manual
 * review rather than deleting a possibly unrelated pathname.
 */
export async function rollbackOwnedBpsPublication({
 parent,stage,destination,identity,parentIdentity,published
}){
 await assertPrivateBpsDirectory(parent,parentIdentity);
 const staged=await optionalStat(stage);
 if(!regularOwned(staged,identity))
  throw new RangeError('BPS staging pathname changed; manual recovery required');
 if(published){
  const named=await optionalStat(destination);
  if(!regularOwned(named,identity)||!same(named,staged)||
     named.nlink!==2||staged.nlink!==2)
   throw new RangeError('Published BPS hardlink ownership changed; manual recovery required');
  await unlink(destination);
  const remaining=await optionalStat(stage);
  if(!regularOwned(remaining,identity)||remaining.nlink!==1)
   throw new RangeError('BPS stage changed during rollback; manual recovery required');
 }else if(staged.nlink!==1){
  throw new RangeError('BPS stage has foreign hardlinks; manual recovery required');
 }
 await unlink(stage);
 await syncBpsDirectory(parent);
 return true;
}
