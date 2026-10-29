#!/usr/bin/env node
/**
 * Explicit recovery of a PRE-publication BPS Save As stage.
 * Requires independently supplied source AND target SHA-256, exact BPS replay,
 * a single private, unlinked stage and an absent destination.
 * This never authorizes CUBE semantic editing or overwrites an existing ROM.
 */
import {constants} from 'node:fs';
import {lstat,readdir,link} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,basename,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readStableLocalFile} from './local-input-safety.mjs';
import {assertPrivateBpsDirectory,finishOwnedBpsPublication}
 from './local-bps-publication-safety.mjs';
import {applyBps} from '../src/core.js';

const HASH=/^[a-f0-9]{64}$/i;
const ROM_LIMIT=64*1024*1024,PATCH_LIMIT=2*1024*1024;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const sameInode=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size;
const sameStable=(a,b)=>sameInode(a,b)&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
async function mustBeAbsent(path){
 try{await lstat(path);}catch(e){if(e?.code==='ENOENT')return;throw e;}
 throw new RangeError('Destination already exists; never overwrite an existing ROM');
}
export function parseOrphanBpsRecoveryArgs(argv){
 if(!Array.isArray(argv)||argv.length!==10)
  throw new RangeError('Exact source, patch, destination and both SHA-256 values required');
 const allowed=new Set(['--rom','--patch','--out','--expected-sha256','--expected-target-sha256']);
 const args={};
 for(let i=0;i<argv.length;i+=2){
  if(!allowed.has(argv[i])||Object.hasOwn(args,argv[i])||
     typeof argv[i+1]!=='string'||!argv[i+1]||argv[i+1].includes('\0'))
   throw new RangeError('Invalid orphan recovery arguments');
  args[argv[i]]=argv[i+1];
 }
 if(Object.keys(args).length!==5||!HASH.test(args['--expected-sha256'])||
    !HASH.test(args['--expected-target-sha256']))
  throw new RangeError('Both exact SHA-256 values are required');
 const [sourcePath,patchPath,destinationPath]=
  [args['--rom'],args['--patch'],args['--out']].map(p=>resolve(p));
 if(new Set([sourcePath,patchPath,destinationPath]).size!==3)
  throw new RangeError('Source, patch and destination must be distinct');
 return {sourcePath,patchPath,destinationPath,
  expectedSourceSha256:args['--expected-sha256'].toLowerCase(),
  expectedTargetSha256:args['--expected-target-sha256'].toLowerCase()};
}
export async function recoverUnpublishedBpsSaveAs(options={}){
 const {sourcePath,patchPath,destinationPath,
  expectedSourceSha256,expectedTargetSha256}=options;
 if([sourcePath,patchPath,destinationPath].some(p=>
    typeof p!=='string'||!p||p.includes('\0'))||
    !HASH.test(expectedSourceSha256||'')||!HASH.test(expectedTargetSha256||''))
  throw new RangeError('Exact source, patch, output and both SHA-256 values required');
 const [source,patch,destination]=[sourcePath,patchPath,destinationPath].map(p=>resolve(p));
 if(new Set([source,patch,destination]).size!==3)
  throw new RangeError('Source, patch and destination must be distinct');
 const parent=dirname(destination);
 const parentIdentity=await assertPrivateBpsDirectory(parent);
 await mustBeAbsent(destination);
 const original=await readStableLocalFile(source,ROM_LIMIT);
 const bps=await readStableLocalFile(patch,PATCH_LIMIT);
 if(original.length<0xC0||sha256(original)!==expectedSourceSha256.toLowerCase())
  throw new RangeError('Source ROM does not match exact SHA-256');
 if(bps.length<19)throw new RangeError('BPS patch too small');
 const expected=Buffer.from(applyBps(original,bps));
 if(expected.length<0xC0||expected.length>ROM_LIMIT||
    sha256(expected)!==expectedTargetSha256.toLowerCase()||
    expected.equals(original))
  throw new RangeError('BPS replay does not match a changed, exact target ROM');
 const entries=await readdir(parent);
 if(entries.length>20000)throw new RangeError('Staging directory scan limit exceeded');
 const prefix='.'+basename(destination)+'.cube-rom-stage-';
 const candidates=entries.filter(name=>name.startsWith(prefix));
 if(candidates.length!==1||!new RegExp('^'+ '[a-f0-9]{24}$').test(
     candidates[0]?.slice(prefix.length)||''))
  throw new RangeError('Exactly one valid stage required; manual review otherwise');
 const stage=join(parent,candidates[0]);
 if(stage===source||stage===patch)
  throw new RangeError('Stage cannot be a source or patch input');
 const before=await lstat(stage);
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||
    before.size!==expected.length||(before.mode&0o077)!==0||
    (typeof process.getuid==='function'&&before.uid!==process.getuid()))
  throw new RangeError('Stage must be a private, owner-controlled, single-link regular file');
 const staged=await readStableLocalFile(stage,ROM_LIMIT);
 if(!staged.equals(expected))
  throw new RangeError('Staged bytes differ from independently replayed BPS target');
 const verifyInputs=async()=>{
  const [reopenedSource,reopenedPatch]=await Promise.all([
   readStableLocalFile(source,ROM_LIMIT),readStableLocalFile(patch,PATCH_LIMIT)]);
  if(!reopenedSource.equals(original)||!reopenedPatch.equals(bps))
   throw new RangeError('Source ROM or patch changed during orphan recovery');
 };
 await verifyInputs();
 await assertPrivateBpsDirectory(parent,parentIdentity);
 await mustBeAbsent(destination);
 const justBefore=await lstat(stage);
 if(!sameStable(before,justBefore)||justBefore.nlink!==1||
    !Buffer.from(await readStableLocalFile(stage,ROM_LIMIT)).equals(expected))
  throw new RangeError('Staging pathname changed during verification');
 // Atomic no-overwrite publication. If anything after link fails, leave both
 // names for explicit published-stage recovery, never delete a foreign path.
 await link(stage,destination);
 await finishOwnedBpsPublication({parent,stage,destination,
  identity:justBefore,parentIdentity});
 const reopened=await readStableLocalFile(destination,ROM_LIMIT);
 if(!reopened.equals(expected)||sha256(reopened)!==expectedTargetSha256.toLowerCase())
  throw new RangeError('Published ROM readback differs from BPS replay');
 await verifyInputs();
 return Object.freeze({schema:'cube-mobile-bps-orphan-recovery/1',
  status:'orphan-published',sourcePreserved:true,patchPreserved:true,
  publishedRomReopened:true,bpsReplayVerified:true,stageRemoved:true,
  semanticWritesAuthorized:false,cubeRomAuthenticated:false,
  gameEmulatorVerified:false,androidHardwareVerified:false,
  strictParityEvidence:false});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(await recoverUnpublishedBpsSaveAs(
  parseOrphanBpsRecoveryArgs(process.argv.slice(2))),null,2)+'\n');}
 catch{
  process.stderr.write('Orphan BPS Save As recovery refused; no existing ROM was intentionally removed.\n');
  process.exitCode=2;
 }
}
