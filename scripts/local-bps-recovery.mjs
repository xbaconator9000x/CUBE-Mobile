#!/usr/bin/env node
/**
 * Explicit crash-recovery companion to local-bps-apply-saveas.mjs.
 * Reopens an existing exact-target ROM and removes ONLY an interrupted,
 * private staging hardlink proven to share that destination's inode.
 * Never overwrites or unlinks the published ROM, source ROM or BPS patch.
 * No private paths, ROM bytes or hashes are printed.
 */
import {constants} from 'node:fs';
import {open,lstat,realpath,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,basename,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readStableLocalFile} from './local-input-safety.mjs';
import {applyBps} from '../src/core.js';

const SHA=/^[0-9a-f]{64}$/i;
const ROM_LIMIT=64*1024*1024;
const PATCH_LIMIT=2*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sameInode=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size;
const stagePrefix=name=>'.'+name+'.cube-rom-stage-';

export function parseBpsRecoveryArgs(argv){
 if(!Array.isArray(argv)||(argv.length!==4&&argv.length!==10))
  throw new RangeError('Expected exact output and target SHA-256; optional source, patch and source SHA-256');
 const allowed=new Set(['--out','--expected-target-sha256',
  '--rom','--patch','--expected-sha256']);
 const args={};
 for(let i=0;i<argv.length;i+=2){
  if(!allowed.has(argv[i])||Object.hasOwn(args,argv[i])||
     typeof argv[i+1]!=='string'||!argv[i+1]||argv[i+1].includes('\\0'))
   throw new RangeError('Invalid recovery arguments');
  args[argv[i]]=argv[i+1];
 }
 if(!args['--out']||!SHA.test(args['--expected-target-sha256']))
  throw new RangeError('Exact target SHA-256 is required');
 const extended=['--rom','--patch','--expected-sha256'];
 const supplied=extended.filter(k=>Object.hasOwn(args,k)).length;
 if(supplied!==0&&supplied!==3)
  throw new RangeError('Source ROM, BPS patch and source SHA-256 must be supplied together');
 if(supplied===3&&!SHA.test(args['--expected-sha256']))
  throw new RangeError('Exact source SHA-256 is required');
 if(supplied===3&&new Set([args['--out'],args['--rom'],args['--patch']]
   .map(p=>resolve(p))).size!==3)
  throw new RangeError('Source, patch and destination paths must be distinct');
 return {destinationPath:args['--out'],
  expectedTargetSha256:args['--expected-target-sha256'],
  ...(supplied===3?{sourcePath:args['--rom'],patchPath:args['--patch'],
   expectedSourceSha256:args['--expected-sha256']}: {})};
}

/**
 * Fail closed on ambiguous stages, symlinks, altered bytes, foreign inodes
 * and writable-by-others directories. A pre-publication orphan cannot be
 * authenticated as the published inode and is deliberately NOT removed.
 */
export async function recoverPublishedBpsSaveAs({
  destinationPath,expectedTargetSha256,sourcePath=null,patchPath=null,
 expectedSourceSha256=null
}={}){
  if(typeof destinationPath!=='string'||!destinationPath||
     destinationPath.includes('\0')||
     typeof expectedTargetSha256!=='string'||!SHA.test(expectedTargetSha256))
    throw new RangeError('Exact output and target SHA-256 required');
  const supplied=[sourcePath,patchPath,expectedSourceSha256].filter(v=>v!==null).length;
  if(supplied!==0&&supplied!==3)
    throw new RangeError('Optional source ROM, BPS patch and digest must be supplied together');
  if(supplied===3&&(!SHA.test(expectedSourceSha256)||
      typeof sourcePath!=='string'||!sourcePath||sourcePath.includes('\\0')||
      typeof patchPath!=='string'||!patchPath||patchPath.includes('\\0')))
    throw new RangeError('Invalid source-bound BPS recovery inputs');
  const destination=resolve(destinationPath),parent=dirname(destination);
  if(supplied===3&&new Set([destination,resolve(sourcePath),resolve(patchPath)]).size!==3)
    throw new RangeError('Recovery inputs and destination must be distinct');
  if(await realpath(parent)!==parent)
    throw new RangeError('Symlinked output directory refused');
  const dirStat=await lstat(parent);
  if(!dirStat.isDirectory()||(dirStat.mode&0o022)!==0||
     (typeof process.getuid==='function'&&dirStat.uid!==process.getuid()))
    throw new RangeError('Recovery requires a private owner-controlled directory');
  const named=await lstat(destination);
  if(named.isSymbolicLink())
    throw new RangeError('Symlinked published ROM refused');
  if(!named.isFile()||named.size<0xC0||named.size>ROM_LIMIT)
    throw new RangeError('Published ROM must be a bounded regular file');
  const target=await readStableLocalFile(destination,ROM_LIMIT);
  if(digest(target)!==expectedTargetSha256.toLowerCase())
    throw new RangeError('Published ROM does not match exact target digest');
  let source=null,patch=null;
  if(supplied===3){
    source=await readStableLocalFile(resolve(sourcePath),ROM_LIMIT);
    patch=await readStableLocalFile(resolve(patchPath),PATCH_LIMIT);
    if(source.length<0xC0||digest(source)!==expectedSourceSha256.toLowerCase())
      throw new RangeError('Recovery source does not match exact source digest');
    const replay=Buffer.from(applyBps(source,patch));
    if(!replay.equals(target)||digest(replay)!==expectedTargetSha256.toLowerCase())
      throw new RangeError('Recovery BPS replay does not match published ROM');
  }
  const verifyInputs=async()=>{
    if(supplied!==3)return;
    const reopenedSource=await readStableLocalFile(resolve(sourcePath),ROM_LIMIT);
    const reopenedPatch=await readStableLocalFile(resolve(patchPath),PATCH_LIMIT);
    if(!reopenedSource.equals(source)||!reopenedPatch.equals(patch))
      throw new RangeError('Recovery source or patch changed during verification');
  };
  await verifyInputs();
  const again=await lstat(destination);
  if(!sameInode(named,again))
    throw new RangeError('Published ROM pathname changed during recovery');
  const entries=await readdir(parent);
  if(entries.length>20000)throw new RangeError('Recovery directory scan limit exceeded');
  const prefix=stagePrefix(basename(destination));
  const candidates=entries.filter(name=>name.startsWith(prefix)&&
    /^[a-f0-9]{24}$/.test(name.slice(prefix.length)));
  const owned=[];
  for(const name of candidates){
    const stage=join(parent,name),info=await lstat(stage);
    if(!info.isFile()||info.isSymbolicLink())
      throw new RangeError('Unsafe staged pathname');
    if(!sameInode(info,again))
      throw new RangeError('Unrelated staged inode requires manual review');
    owned.push({stage,info});
  }
  if(owned.length>1)throw new RangeError('Ambiguous staged links require manual review');
  if(!owned.length){
    await verifyInputs();
    return Object.freeze({schema:'cube-mobile-bps-saveas-recovery/1',
      status:'already-clean',publishedRomReopened:true,
      bpsReplayVerified:supplied===3,
      recoveredStageLink:false,publishedRomPreserved:true,
      semanticWritesAuthorized:false,cubeRomAuthenticated:false,
      gameEmulatorVerified:false,androidHardwareVerified:false,
      strictParityEvidence:false});
  }
  const {stage,info}=owned[0];
  if(info.nlink!==2||again.nlink!==2)
    throw new RangeError('Staged ROM has unexpected hardlink ownership');
  const stageBytes=await readStableLocalFile(stage,ROM_LIMIT);
  if(!stageBytes.equals(target))
    throw new RangeError('Staged link does not match exact published ROM');
  const stageBefore=await lstat(stage),destinationBefore=await lstat(destination);
  await verifyInputs();
  if(!sameInode(stageBefore,info)||!sameInode(destinationBefore,again)||
     !sameInode(stageBefore,destinationBefore)||
     stageBefore.nlink!==2||destinationBefore.nlink!==2||
     await realpath(parent)!==parent)
    throw new RangeError('Staged link changed before recovery');
  // Only unlink the redundant stage name, never the published destination.
  await unlink(stage);
  const published=await lstat(destination);
  if(!sameInode(published,again)||published.nlink!==1)
    throw new RangeError('Published ROM inode changed during stage recovery');
  const reopened=await readStableLocalFile(destination,ROM_LIMIT);
  if(!reopened.equals(target)||digest(reopened)!==expectedTargetSha256.toLowerCase())
    throw new RangeError('Published ROM changed after stage recovery');
  await verifyInputs();
  const dir=await open(parent,constants.O_RDONLY);
  try{await dir.sync();}finally{await dir.close();}
  return Object.freeze({schema:'cube-mobile-bps-saveas-recovery/1',
    status:'stage-link-recovered',publishedRomReopened:true,
    bpsReplayVerified:supplied===3,
    recoveredStageLink:true,publishedRomPreserved:true,
    semanticWritesAuthorized:false,cubeRomAuthenticated:false,
    gameEmulatorVerified:false,androidHardwareVerified:false,
    strictParityEvidence:false});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    process.stdout.write(JSON.stringify(await recoverPublishedBpsSaveAs(
      parseBpsRecoveryArgs(process.argv.slice(2))),null,2)+'\n');
  }catch{
    process.stderr.write('Local BPS Save As recovery refused; published ROM was not intentionally removed.\n');
    process.exitCode=2;
  }
}
