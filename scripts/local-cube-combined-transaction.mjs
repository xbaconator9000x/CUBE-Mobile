#!/usr/bin/env node
/**
 * Local five-kind CUBE transaction acceptance rehearsal. NEVER writes a ROM.
 * A user-provided hash, TOML and bank counts are not independent authentication.
 * Reports contain counts and booleans only: no ROM bytes, paths, pointers or hashes.
 */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readStableLocalFile} from './local-input-safety.mjs';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {verifyHmaCubeCombinedTransaction} from '../src/hma-cube-combined-transaction.js';
import {auditHmaCubeEditOwnershipImpact} from '../src/hma-cube-edit-ownership-impact.js';
import {parseLocalCubeScriptTransactionArgs} from './local-cube-script-transaction.mjs';

const KINDS=['cells','warps','events','connections','scripts'];
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
function declaredBanks(raw,bankIndex,mapCount){
 if(typeof raw!=='string'||!/^[0-9]+:[0-9]+(?:,[0-9]+:[0-9]+)*$/.test(raw))
  throw RangeError('Explicit bank:count declarations are required');
 const banks=raw.split(',').map(pair=>{
  const [bankIndex,mapCount]=pair.split(':').map(Number);
  if(!Number.isSafeInteger(bankIndex)||bankIndex<0||bankIndex>255||
     !Number.isSafeInteger(mapCount)||mapCount<1||mapCount>128)
   throw RangeError('Bank declaration exceeds safe limits');
  return {bankIndex,mapCount};
 });
 if(banks.length>8||new Set(banks.map(b=>b.bankIndex)).size!==banks.length||
    banks.reduce((sum,b)=>sum+b.mapCount,0)>256||
    !banks.some(b=>b.bankIndex===bankIndex&&b.mapCount===mapCount))
  throw RangeError('Bank census must be bounded and include the selected map bank');
 return banks;
}
function parsePlan(bytes){
 let plan;
 try{plan=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw RangeError('Transaction plan is not valid UTF-8 JSON');}
 if(!plan||typeof plan!=='object'||Array.isArray(plan)||
    Object.keys(plan).some(k=>![...KINDS,'viewport'].includes(k)))
  throw RangeError('Transaction plan contains unsupported fields');
 let count=0;
 for(const kind of KINDS){
  if(plan[kind]===undefined)continue;
  if(!Array.isArray(plan[kind])||plan[kind].length>32||
     plan[kind].some(change=>!change||typeof change!=='object'||Array.isArray(change)))
   throw RangeError('Each transaction kind requires at most 32 object proposals');
  count+=plan[kind].length;
 }
 if(!count)throw RangeError('At least one edit proposal is required');
 const viewport=plan.viewport??{};
 if(!viewport||typeof viewport!=='object'||Array.isArray(viewport)||
    Object.keys(viewport).some(k=>!['x','y','viewportWidth','viewportHeight'].includes(k)))
  throw RangeError('Invalid viewport declaration');
 for(const [key,value] of Object.entries(viewport)){
  const maximum=key==='x'||key==='y'?1023:32;
  const minimum=key==='x'||key==='y'?0:1;
  if(!Number.isSafeInteger(value)||value<minimum||value>maximum)
   throw RangeError('Viewport value outside bounded range');
 }
 return {changes:Object.fromEntries(KINDS.map(k=>[k,plan[k]??[]])),
  viewport,count};
}
/**
 * Rehearse the full five-kind transaction and a separately recomputed
 * cross-bank edited-byte ownership intersection against local inputs.
 * This intentionally never returns patch bytes or write authorization.
 */
export async function inspectLocalCubeCombinedTransaction(argv){
 const args=parseLocalCubeScriptTransactionArgs(argv);
 if(args['--banks']===undefined)
  throw RangeError('Explicit partial ownership census banks are required');
 const bankIndex=Number(args['--bank-index']),mapIndex=Number(args['--map-index']),
  mapCount=Number(args['--map-count']);
 const banks=declaredBanks(args['--banks'],bankIndex,mapCount);
 const rom=await readStableLocalFile(args['--rom'],64*1024*1024);
 const originalHash=sha(rom);
 if(originalHash!==args['--expected-sha256'].toLowerCase())
  throw RangeError('ROM differs from user-declared SHA-256');
 const metadata=await readStableLocalFile(args['--metadata'],4*1024*1024);
 const summary=inspectHmaMapBankAnchorSources([{
  name:'local-cube-metadata',
  text:new TextDecoder('utf-8',{fatal:true}).decode(metadata)
 }],{romSize:rom.length});
 if(summary.status!=='custom-candidate'||summary.uniqueDeclarationCount!==1)
  throw RangeError('Unambiguous CUBE custom map metadata required');
 const {changes,viewport,count}=parsePlan(await readStableLocalFile(args['--plan'],64*1024));
 const options={bankIndex,mapIndex,mapCount,banks,targetBanks:banks,...changes,...viewport};
 const rehearsal=verifyHmaCubeCombinedTransaction(rom,summary,options);
 const ownership=auditHmaCubeEditOwnershipImpact(rom,summary,{
  ...options,wholeRomPointerScan:true
 });
 if(!rehearsal.combinedReDecodeVerified||!rehearsal.inMemoryRollbackVerified||
    !rehearsal.sourceBytesPreserved||!ownership.copyOnlyRehearsalVerified||
    rehearsal.changedBytes!==ownership.changedBytes||sha(rom)!==originalHash)
  throw RangeError('Combined transaction or ownership evidence disagrees');
 const reopened=await readStableLocalFile(args['--rom'],64*1024*1024);
 if(sha(reopened)!==originalHash||!reopened.equals(rom))
  throw RangeError('Original ROM changed during local transaction');
 return Object.freeze({
  schema:'cube-mobile-local-combined-transaction-smoke/1',
  userDeclaredRomHashMatched:true,customMetadataFormatRecognized:true,
  proposals:count,cellChanges:rehearsal.cellChanges,warpChanges:rehearsal.warpChanges,
  eventChanges:rehearsal.eventChanges,connectionChanges:rehearsal.connectionChanges,
  scriptChanges:rehearsal.scriptChanges,changedBytes:rehearsal.changedBytes,
  combinedReDecodeVerified:true,rollbackVerified:true,sourcePreserved:true,
  inspectedMaps:ownership.inspectedMaps,decodedMaps:ownership.decodedMaps,
  ownershipConflicts:ownership.conflicts.length,
  ownershipCensusIncomplete:ownership.censusIncomplete,
  mapScriptOwnershipIssues:ownership.mapScriptIssueCount,
  globalPointerCensus:ownership.globalPointerCandidates,
  partialOwnershipCoverage:true,globalPointerOwnershipProven:false,
  romModified:false,romExported:false,patchExported:false,
  independentlyAuthenticated:false,exclusiveOwnershipProven:false,
  emulatorVerified:false,androidHardwareVerified:false,writeAuthorized:false,
  strictParityEvidence:false,
  warning:'User-supplied ROM hash, metadata and map counts do not authenticate CUBE. Whole-ROM aligned pointer candidates are heuristic, not an alias graph or ownership proof. This is a read-only rehearsal, not edited-ROM save/reopen or gameplay acceptance.'
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(
  await inspectLocalCubeCombinedTransaction(process.argv.slice(2)),null,2)+'\n');}
 catch{
  process.stderr.write('Local combined CUBE transaction refused; inspect local inputs and expected bytes. No ROM was written.\n');
  process.exitCode=2;
 }
}
