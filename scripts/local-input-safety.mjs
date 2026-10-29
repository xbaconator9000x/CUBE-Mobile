/**
 * Local CUBE acceptance input boundary. Do not print file paths or bytes.
 * Reject symlink paths and changing inodes before decoding ROM/TOML/plans.
 */
import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';

function same(a,b){
 return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&
  a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
}
export async function readStableLocalFile(path,max){
 if(typeof path!=='string'||!path||path.includes('\0')||
    !Number.isSafeInteger(max)||max<1||max>64*1024*1024)
  throw RangeError('Invalid bounded local input request');
 const canonical=resolve(path);
 if(await realpath(canonical)!==canonical)
  throw RangeError('Local input path traverses a symlink');
 const before=await lstat(canonical);
 if(!before.isFile()||before.isSymbolicLink()||before.size<1||before.size>max)
  throw RangeError('Local input must be a bounded regular non-symlink file');
 const file=await open(canonical,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const opened=await file.stat();
  if(!same(before,opened))
   throw RangeError('Local input changed before reading');
  const bytes=await file.readFile(),after=await file.stat();
  if(!same(opened,after)||bytes.length!==opened.size)
   throw RangeError('Local input changed while reading');
  // Verify the path still names the inode we read; checking only the open
  // descriptor would miss a rename/replacement during the read.
  const named=await lstat(canonical);
  if(!named.isFile()||named.isSymbolicLink()||!same(after,named)||
     await realpath(canonical)!==canonical)
   throw RangeError('Local input pathname changed while reading');
  return bytes;
 }finally{await file.close();}
}
