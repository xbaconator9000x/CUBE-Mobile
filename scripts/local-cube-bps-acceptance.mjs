#!/usr/bin/env node
/**
 * Read-only acceptance of a caller-supplied BPS against a five-kind CUBE
 * semantic edit proposal. Never creates a patch or edited ROM.
 * All identity assertions are caller supplied; NO semantic write approval.
 */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readStableLocalFile} from './local-input-safety.mjs';
import {inspectLocalCubeCombinedTransaction,parsePlan,declaredBanks} from './local-cube-combined-transaction.mjs';
import {parseLocalCubeScriptTransactionArgs} from './local-cube-script-transaction.mjs';
import {verifyLocalBpsPatch} from './local-bps-verify.mjs';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {verifyHmaCubeCombinedTransaction} from '../src/hma-cube-combined-transaction.js';
import {applyBps} from '../src/core.js';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const EXTRA=new Set(['--patch','--expected-target-sha256']);
const SHA=/^[0-9a-f]{64}$/i;
export function parseLocalCubeBpsAcceptanceArgs(argv){
 if(!Array.isArray(argv)||argv.length!==20)
  throw new RangeError('Exact five-kind CUBE plan, BPS patch and target digest required');
 const args={},base=[];
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(typeof key!=='string'||typeof value!=='string'||!value||
     value.includes('\0')||Object.hasOwn(args,key))
   throw new RangeError('Invalid or duplicate CUBE BPS acceptance argument');
  args[key]=value;
  if(!EXTRA.has(key))base.push(key,value);
 }
 if(Object.keys(args).length!==10||!EXTRA.has('--patch')||
    !Object.hasOwn(args,'--patch')||!SHA.test(args['--expected-target-sha256']))
  throw new RangeError('Exact BPS target digest and patch required');
 const validated=parseLocalCubeScriptTransactionArgs(base);
 if(validated['--banks']===undefined)
  throw new RangeError('Explicit bounded ownership banks are required');
 const paths=['--rom','--metadata','--plan','--patch'].map(k=>resolve(args[k]));
 if(new Set(paths).size!==paths.length)
  throw new RangeError('ROM, metadata, plan and patch must be distinct files');
 return {args:Object.freeze(args),base};
}
export async function inspectLocalCubeBpsAcceptance(argv){
 const {args,base}=parseLocalCubeBpsAcceptanceArgs(argv);
 // This existing path performs copy-only re-decode/rollback, bounded
 // cross-bank ownership and whole-ROM pointer-candidate census.
 const census=await inspectLocalCubeCombinedTransaction(base);
 if(!census.combinedReDecodeVerified||!census.rollbackVerified||
    !census.sourcePreserved||census.ownershipConflicts!==0)
  throw new RangeError('CUBE semantic rehearsal or bounded ownership refused');
 const [rom,metadata,plan,patch]=await Promise.all([
  readStableLocalFile(args['--rom'],64*1024*1024),
  readStableLocalFile(args['--metadata'],4*1024*1024),
  readStableLocalFile(args['--plan'],64*1024),
  readStableLocalFile(args['--patch'],2*1024*1024)
 ]);
 if(rom.length<0xC0||sha(rom)!==args['--expected-sha256'].toLowerCase())
  throw new RangeError('CUBE ROM source identity changed');
 const target=applyBps(rom,patch); // independently checks BPS source, target and patch CRCs
 if(sha(target)!==args['--expected-target-sha256'].toLowerCase())
  throw new RangeError('BPS target digest differs from declared target');
 const summary=inspectHmaMapBankAnchorSources([{
  name:'local-cube-metadata',
  text:new TextDecoder('utf-8',{fatal:true}).decode(metadata)
 }],{romSize:rom.length});
 if(summary.status!=='custom-candidate'||summary.uniqueDeclarationCount!==1)
  throw new RangeError('CUBE map metadata no longer unambiguous');
 const bankIndex=Number(args['--bank-index']),mapCount=Number(args['--map-count']);
 const banks=declaredBanks(args['--banks'],bankIndex,mapCount);
 const {changes,viewport}=parsePlan(plan);
 const result=verifyHmaCubeCombinedTransaction(rom,summary,{
  bankIndex,mapIndex:Number(args['--map-index']),mapCount,banks,targetBanks:banks,
  ...changes,...viewport,targetRom:target
 });
 if(!result.targetReplayMatched||result.changedBytes!==census.changedBytes)
  throw new RangeError('BPS target and independent CUBE semantic rehearsal disagree');
 const independent=await verifyLocalBpsPatch([
  '--rom',args['--rom'],'--patch',args['--patch'],
  '--expected-sha256',args['--expected-sha256'],
  '--expected-target-sha256',args['--expected-target-sha256']
 ]);
 if(independent.changedBytes!==result.changedBytes||
    !independent.patchReopenVerified||!independent.sourcePreserved)
  throw new RangeError('Independent BPS reopen acceptance disagrees');
 const again=await Promise.all([
  readStableLocalFile(args['--rom'],64*1024*1024),
  readStableLocalFile(args['--metadata'],4*1024*1024),
  readStableLocalFile(args['--plan'],64*1024),
  readStableLocalFile(args['--patch'],2*1024*1024)
 ]);
 if([rom,metadata,plan,patch].some((before,i)=>!again[i].equals(before)))
  throw new RangeError('CUBE acceptance input changed during verification');
 return Object.freeze({
  schema:'cube-mobile-local-cube-bps-semantic-acceptance/1',
  proposals:census.proposals,changedBytes:result.changedBytes,
  cellChanges:result.cellChanges,warpChanges:result.warpChanges,
  eventChanges:result.eventChanges,connectionChanges:result.connectionChanges,
  scriptChanges:result.scriptChanges,
  exactSourceSha256Matched:true,exactTargetSha256Matched:true,
  bpsCrcVerified:true,independentBpsReopenVerified:true,
  exactSemanticTargetReplayVerified:true,combinedReDecodeVerified:true,
  inMemoryRollbackVerified:true,allFourInputsPreserved:true,
  boundedOwnershipConflicts:census.ownershipConflicts,
  boundedOwnershipCensusIncomplete:census.ownershipCensusIncomplete,
  globalPointerOwnershipProven:false,
  upstreamMetadataExactBytesMatched:census.upstreamMetadataExactBytesMatched,
  romBuildProvenanceVerified:false,independentlyAuthenticated:false,
  romModified:false,romExported:false,patchExported:false,
  emulatorVerified:false,androidHardwareVerified:false,
  writeAuthorized:false,strictParityEvidence:false,readOnly:true,
  warning:'Exact semantic replay proves only the caller-supplied patch matches a bounded, source-grounded five-kind preview. It does not authenticate CUBE ROM provenance, complete pointer ownership, safe semantic writes or emulator/hardware behavior.'
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(
  await inspectLocalCubeBpsAcceptance(process.argv.slice(2)),null,2)+'\n');}
 catch{
  process.stderr.write('Local CUBE BPS semantic acceptance refused. No files were modified.\n');
  process.exitCode=2;
 }
}
