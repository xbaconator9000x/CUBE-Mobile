#!/usr/bin/env node
/**
 * Opt-in local BPS -> NEW ROM Save As, not CUBE semantic write authorization.
 * Requires independently supplied exact source AND target SHA-256 assertions.
 * Never overwrites, renames, edits or exports the original source ROM.
 * No paths, hashes, source bytes or target bytes are printed.
 */
import {constants} from 'node:fs';
import {open, lstat, link} from 'node:fs/promises';
import {assertPrivateBpsDirectory,finishOwnedBpsPublication,
 rollbackOwnedBpsPublication} from './local-bps-publication-safety.mjs';
import {createHash, randomBytes} from 'node:crypto';
import {resolve, dirname, basename, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readStableLocalFile} from './local-input-safety.mjs';
import {parseExpectedBytePlan} from './local-bps-diff.mjs';
import {applyBps} from '../src/core.js';
// Explicit, opt-in recovery for interrupted post-publication staging hardlinks.
export {recoverPublishedBpsSaveAs} from './local-bps-recovery.mjs';

const HASH=/^[0-9a-f]{64}$/i;
const ROM_LIMIT=64*1024*1024;
const PATCH_LIMIT=2*1024*1024;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const sameInode=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size;
const sameStat=(a,b)=>sameInode(a,b)&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;

export function parseLocalBpsSaveAsArgs(argv){
 const keys=new Set(['--rom','--patch','--out','--expected-sha256','--expected-target-sha256','--plan']);
 if(!Array.isArray(argv)||(argv.length!==10&&argv.length!==12))
  throw new RangeError('Five required BPS Save As arguments and optional plan required');
 const args={};
 for(let i=0;i<argv.length;i+=2){
  if(!keys.has(argv[i])||Object.hasOwn(args,argv[i])||
     typeof argv[i+1]!=='string'||!argv[i+1]||argv[i+1].includes('\0'))
   throw new RangeError('Invalid or duplicate BPS Save As argument');
  args[argv[i]]=argv[i+1];
 }
 if(Object.keys(args).length!==argv.length/2||
    !['--rom','--patch','--out','--expected-sha256','--expected-target-sha256'].every(k=>Object.hasOwn(args,k))||
    !HASH.test(args['--expected-sha256'])||
    !HASH.test(args['--expected-target-sha256']))
  throw new RangeError('Exact source and target SHA-256 required');
 const paths=[args['--rom'],args['--patch'],args['--out'],...(args['--plan']?[args['--plan']]:[])].map(path=>resolve(path));
 if(new Set(paths).size!==paths.length)throw new RangeError('All local BPS input and output paths must be distinct');
 return args;
}
async function absent(path){
 try{await lstat(path);throw new RangeError('Destination already exists');}
 catch(error){if(error?.code!=='ENOENT')throw error;}
}
async function reopenOwned(path,identity,expected,hash){
 const named=await lstat(path);
 if(!named.isFile()||named.isSymbolicLink()||!sameInode(named,identity))
  throw new RangeError('Published ROM pathname changed identity');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const before=await file.stat();
  if(!sameInode(before,identity)||!sameStat(before,named))
   throw new RangeError('Published ROM inode changed before readback');
  const bytes=await file.readFile();
  const after=await file.stat();
  if(!sameStat(before,after)||bytes.length!==expected.length||
     !bytes.equals(expected)||sha256(bytes)!==hash)
   throw new RangeError('Published ROM readback differs from verified target');
 }finally{await file.close();}
 const namedAfter=await lstat(path);
 if(!sameInode(namedAfter,identity)||namedAfter.isSymbolicLink())
  throw new RangeError('Published ROM pathname changed during readback');
}
async function unchanged(path,expected,max){
 const reopened=await readStableLocalFile(path,max);
 if(!reopened.equals(expected))throw new RangeError('Local BPS input changed during publication');
}
export async function saveLocalBpsTargetAs(argv){
 const args=parseLocalBpsSaveAsArgs(argv);
 const sourcePath=resolve(args['--rom']),patchPath=resolve(args['--patch']),
  destination=resolve(args['--out']),parent=dirname(destination);
 const parentIdentity=await assertPrivateBpsDirectory(parent);
 await absent(destination);
 const source=await readStableLocalFile(sourcePath,ROM_LIMIT);
 const patch=await readStableLocalFile(patchPath,PATCH_LIMIT);
 const sourceHash=args['--expected-sha256'].toLowerCase();
 const targetHash=args['--expected-target-sha256'].toLowerCase();
 if(source.length<0xC0||sha256(source)!==sourceHash)
  throw new RangeError('Source ROM does not match exact SHA-256');
 if(patch.length<19)throw new RangeError('BPS patch too small');
 const target=Buffer.from(applyBps(source,patch));
 if(target.length<0xC0||target.length>ROM_LIMIT||sha256(target)!==targetHash)
  throw new RangeError('BPS replay differs from exact target SHA-256');
 if(target.length===source.length&&target.equals(source))
  throw new RangeError('BPS patch produces no changed ROM bytes');
 // Optional strict raw-byte plan: prove every byte outside the declared
 // expected-byte edits is unchanged, not merely that BPS CRCs agree.
 const planPath=args['--plan']?resolve(args['--plan']):null;
 const planBytes=planPath?await readStableLocalFile(planPath,2*1024*1024):null;
 let scopedEdits=0;
 if(planBytes){
  if(target.length!==source.length)
   throw new RangeError('Expected-byte plan cannot authorize ROM length changes');
  const edits=parseExpectedBytePlan(planBytes,source);
  const planned=new Map(edits);
  for(let i=0;i<source.length;i++){
   const expected=planned.has(i)?planned.get(i):source[i];
   if(target[i]!==expected)
    throw new RangeError('BPS target changes an undeclared or mismatched byte');
   if(source[i]!==target[i])scopedEdits++;
  }
  if(!scopedEdits)throw new RangeError('Expected-byte plan has no effective edits');
 }
 const verifyInputs=()=>Promise.all([
  unchanged(sourcePath,source,ROM_LIMIT),
  unchanged(patchPath,patch,PATCH_LIMIT),
  ...(planPath?[unchanged(planPath,planBytes,2*1024*1024)]:[])
 ]);
 // Verify original inputs and private output-directory identity before publication.
 await verifyInputs();
 await assertPrivateBpsDirectory(parent,parentIdentity);
 const stage=join(parent,'.'+basename(destination)+'.cube-rom-stage-'+randomBytes(12).toString('hex'));
 let staged=false,published=false,identity=null;
 try{
  const file=await open(stage,constants.O_WRONLY|constants.O_CREAT|
   constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  staged=true;
  try{await file.writeFile(target);await file.sync();}
  finally{await file.close();}
  identity=await lstat(stage);
  if(!identity.isFile()||identity.isSymbolicLink())
   throw new RangeError('Staged target is not a regular file');
  await reopenOwned(stage,identity,target,targetHash);
  // Revalidate the output directory before atomic no-overwrite publication.
  await assertPrivateBpsDirectory(parent,parentIdentity);
  await link(stage,destination);
  published=true;
  const linked=await lstat(destination);
  if(!sameInode(linked,identity)||!linked.isFile()||linked.isSymbolicLink())
   throw new RangeError('Published target is not the staged inode');
  await reopenOwned(destination,linked,target,targetHash);
  // Check both original inputs after publication. Any mismatch rolls back
  // only the newly published destination, not the source or patch.
  await verifyInputs();
  await finishOwnedBpsPublication({parent,stage,destination,identity,parentIdentity});
  staged=false;
  return Object.freeze({
   schema:'cube-mobile-local-bps-target-saveas/1',
   sourceBytes:source.length,patchBytes:patch.length,targetBytes:target.length,
   exactSourceSha256Matched:true,exactTargetSha256Matched:true,
   bpsCrcAndReplayVerified:true,stagedReopenVerified:true,
   destinationReopenVerified:true,originalSourcePreserved:true,
   originalPatchPreserved:true,atomicNoOverwrite:true,
   expectedBytePlanVerified:!!planBytes,unrelatedBytesPreserved:!!planBytes,
   scopedChangedBytes:planBytes?scopedEdits:null,
   newRomCopyPublished:true,sourceRomModified:false,
   cubeRomAuthenticated:false,exclusiveOwnershipProven:false,
   semanticWritesAuthorized:false,gameEmulatorVerified:false,
   androidHardwareVerified:false,strictParityEvidence:false
  });
 }catch(error){
  // Never blindly unlink a path after a failed transaction. A concurrent
  // replacement, extra hardlink, or changed directory requires manual review.
  if(staged&&identity)
   await rollbackOwnedBpsPublication({
    parent,stage,destination,identity,parentIdentity,published
   });
  throw error;
 }

}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(
  await saveLocalBpsTargetAs(process.argv.slice(2)),null,2)+'\n');}
 catch{
  process.stderr.write('Local BPS ROM Save As refused; original inputs were not modified.\n');
  process.exitCode=2;
 }
}
