#!/usr/bin/env node
/**
 * Local-only, byte-identical ROM Save As foundation. NEVER applies map edits.
 * No ROM bytes, source paths, or SHA-256 digests are printed.
 * This is filesystem transaction evidence, not CUBE compatibility acceptance.
 */
import {constants} from 'node:fs';
import {open,lstat,realpath,readFile,link,unlink} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {resolve,dirname,basename,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const HASH=/^[a-f0-9]{64}$/i;
const LIMIT=64*1024*1024;
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
function sameIdentity(a,b){
 return a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&
  a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
}
async function noDestination(path){
 try{await lstat(path);throw RangeError('Destination already exists');}
 catch(e){if(e?.code!=='ENOENT')throw e;}
}
async function verifiedSource(path,expected){
 const info=await lstat(path);
 if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>LIMIT)
  throw RangeError('Source must be a bounded regular file, not a symlink');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=await file.stat();
  if(!sameIdentity(info,before))throw RangeError('Source changed before reading');
  const bytes=await file.readFile();
  const after=await file.stat();
  if(!sameIdentity(before,after)||bytes.length!==before.size||
     digest(bytes)!==expected)
   throw RangeError('Source changed or differs from expected SHA-256');
  return bytes;
 }finally{await file.close();}
}
/**
 * Atomic no-overwrite local Save As of UNMODIFIED ROM bytes.
 * A private temp file is fsynced, reopened, byte-compared and hard-linked
 * into place (exclusive link never overwrites an existing destination).
 * On failure only a destination inode created by this invocation is removed.
 */
export async function saveUnmodifiedRomAs({sourcePath,destinationPath,expectedSha256}={}){
 if(typeof sourcePath!=='string'||!sourcePath||typeof destinationPath!=='string'||
    !destinationPath||typeof expectedSha256!=='string'||!HASH.test(expectedSha256))
  throw RangeError('Source, destination and expected SHA-256 are required');
 const source=resolve(sourcePath),destination=resolve(destinationPath);
 if(source===destination)throw RangeError('Source and destination must differ');
 const parent=dirname(destination);
 if(await realpath(parent)!==parent)
  throw RangeError('Destination parent must not traverse a symlink');
 await noDestination(destination);
 const expected=expectedSha256.toLowerCase();
 const bytes=await verifiedSource(source,expected);
 const temp=join(parent,'.'+basename(destination)+'.cube-stage-'+randomBytes(12).toString('hex'));
 let createdTemp=false,createdDestination=false,tempIdentity=null;
 try{
  const handle=await open(temp,constants.O_WRONLY|constants.O_CREAT|
   constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  createdTemp=true;
  try{await handle.writeFile(bytes);await handle.sync();}
  finally{await handle.close();}
  tempIdentity=await lstat(temp);
  const reopened=await readFile(temp);
  if(digest(reopened)!==expected||!reopened.equals(Buffer.from(bytes)))
   throw RangeError('Staged ROM failed exact byte reopen');
  const originalAgain=await verifiedSource(source,expected);
  if(!originalAgain.equals(Buffer.from(bytes)))
   throw RangeError('Source changed during Save As');
  await link(temp,destination); // EEXIST is atomic and cannot overwrite.
  createdDestination=true;
  const saved=await readFile(destination);
  if(digest(saved)!==expected||!saved.equals(Buffer.from(bytes)))
   throw RangeError('Saved ROM failed exact byte reopen');
  await verifiedSource(source,expected);
  const dir=await open(parent,constants.O_RDONLY);
  try{await dir.sync();}finally{await dir.close();}
  await unlink(temp);createdTemp=false;
  return Object.freeze({
   byteCount:bytes.length,expectedSourceHashMatched:true,
   stagedReopenVerified:true,destinationReopenVerified:true,
   originalSourcePreserved:true,atomicNoOverwrite:true,
   sourceRomEdited:false,mapChangesApplied:false,
   romAuthenticated:false,exclusiveOwnershipProven:false,
   emulatorVerified:false,androidHardwareVerified:false,
   strictParityEvidence:false
  });
 }catch(error){
  if(createdDestination){
   try{
    const now=await lstat(destination);
    if(tempIdentity&&now.dev===tempIdentity.dev&&now.ino===tempIdentity.ino)
     await unlink(destination);
   }catch(e){if(e?.code!=='ENOENT')throw e;}
  }
  throw error;
 }finally{
  if(createdTemp)try{await unlink(temp);}catch(e){if(e?.code!=='ENOENT')throw e;}
 }
}
function parseArgs(argv){
 if(!Array.isArray(argv)||argv.length!==6)throw RangeError('Three explicit arguments required');
 const args={};
 for(let i=0;i<argv.length;i+=2){
  if(!['--source','--destination','--expected-sha256'].includes(argv[i])||
     Object.hasOwn(args,argv[i])||typeof argv[i+1]!=='string')
   throw RangeError('Invalid or repeated Save As argument');
  args[argv[i]]=argv[i+1];
 }
 if(Object.keys(args).length!==3)throw RangeError('Incomplete Save As arguments');
 return {sourcePath:args['--source'],destinationPath:args['--destination'],
  expectedSha256:args['--expected-sha256']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(
  await saveUnmodifiedRomAs(parseArgs(process.argv.slice(2))),null,2)+'\n');}
 catch(_error){
  process.stderr.write('Local byte-identical Save As refused; no edit authorization or ROM compatibility is implied.\n');
  process.exitCode=2;
 }
}
