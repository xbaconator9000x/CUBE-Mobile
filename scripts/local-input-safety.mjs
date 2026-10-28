/**
 * Local CUBE acceptance input boundary. Do not print file paths or bytes.
 * Reject symlink paths and changing inodes before decoding ROM/TOML/plans.
 */
import {constants} from 'node:fs';
import {lstat,open} from 'node:fs/promises';

function same(a,b){
 return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&
  a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
}
export async function readStableLocalFile(path,max){
 if(typeof path!=='string'||!path||path.includes('\0')||
    !Number.isSafeInteger(max)||max<1||max>64*1024*1024)
  throw RangeError('Invalid bounded local input request');
 const before=await lstat(path);
 if(!before.isFile()||before.isSymbolicLink()||before.size<1||before.size>max)
  throw RangeError('Local input must be a bounded regular non-symlink file');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const opened=await file.stat();
  if(!same(before,opened))
   throw RangeError('Local input changed before reading');
  const bytes=await file.readFile(),after=await file.stat();
  if(!same(opened,after)||bytes.length!==opened.size)
   throw RangeError('Local input changed while reading');
  return bytes;
 }finally{await file.close();}
}
