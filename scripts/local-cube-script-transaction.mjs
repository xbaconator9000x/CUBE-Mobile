#!/usr/bin/env node
/**
 * Local-only CUBE script-reference transaction acceptance rehearsal.
 * User-declared SHA-256 is NOT independently curated ROM authentication.
 * No ROM/metadata bytes, paths, digests, pointer addresses or script bytes
 * appear in reports. No output ROM or patch file is created.
 */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readStableLocalFile} from './local-input-safety.mjs';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaCubeScriptReferences,previewHmaCubeScriptRetargetBatch,
 verifyHmaCubeScriptRetargetDryRun} from '../src/hma-cube-script-retarget.js';
import {auditHmaCubeEditOwnershipImpact} from '../src/hma-cube-edit-ownership-impact.js';

const SHA=/^[0-9a-f]{64}$/i;
const KEYS=['--rom','--metadata','--expected-sha256','--bank-index',
 '--map-index','--map-count','--plan'];
export function parseLocalCubeScriptTransactionArgs(argv){
 if(!Array.isArray(argv)||![KEYS.length*2,(KEYS.length+1)*2].includes(argv.length))
  throw RangeError('Provide ROM, metadata, expected SHA-256, map selection and plan');
 const args={};
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(![...KEYS,'--banks'].includes(key)||Object.hasOwn(args,key)||
     typeof value!=='string'||!value||value.includes('\0'))
   throw RangeError('Invalid or repeated local transaction argument');
  args[key]=value;
 }
 if(KEYS.some(key=>!Object.hasOwn(args,key))||
    !SHA.test(args['--expected-sha256']))
  throw RangeError('Complete local transaction arguments and SHA-256 required');
 for(const key of ['--bank-index','--map-index','--map-count']){
  const s=args[key];
  if(!/^(?:0|[1-9][0-9]{0,3})$/.test(s))
   throw RangeError('Invalid explicit CUBE map selection');
  const n=Number(s);
  if(n>(key==='--bank-index'?255:1024)||
     (key==='--map-count'&&n<1)||
     (key==='--map-index'&&n>1023))
   throw RangeError('Map selection exceeds safe bounds');
 }
 if(Number(args['--map-index'])>=Number(args['--map-count']))
  throw RangeError('Map index exceeds explicit count');
 if(args['--banks']!==undefined)parseDeclaredBanks(args['--banks'],
  Number(args['--bank-index']),Number(args['--map-count']));
 return Object.freeze(args);
}
/** Exact bank:map-count pairs are user declarations, never inferred map ownership. */
function parseDeclaredBanks(value,sourceBank,sourceCount){
 if(typeof value!=='string'||!/^[0-9]+:[0-9]+(?:,[0-9]+:[0-9]+)*$/.test(value))
  throw RangeError('Declare banks as comma-separated bank:map-count pairs');
 const banks=value.split(',').map(pair=>{
  const [bankIndex,mapCount]=pair.split(':').map(Number);
  if(!Number.isSafeInteger(bankIndex)||bankIndex<0||bankIndex>255||
     !Number.isSafeInteger(mapCount)||mapCount<1||mapCount>128)
   throw RangeError('Declared bank index or map count outside bounds');
  return {bankIndex,mapCount};
 });
 if(banks.length>8||new Set(banks.map(b=>b.bankIndex)).size!==banks.length||
    banks.reduce((sum,b)=>sum+b.mapCount,0)>256||
    !banks.some(b=>b.bankIndex===sourceBank&&b.mapCount===sourceCount))
  throw RangeError('Ownership census must include exact source bank and remain bounded');
 return banks;
}
function parsePlan(bytes){
 let plan;
 try{plan=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch(_error){throw RangeError('Transaction plan must be valid UTF-8 JSON');}
 if(!plan||Array.isArray(plan)||Object.keys(plan).length!==1||
    !Array.isArray(plan.changes)||plan.changes.length<1||plan.changes.length>32)
  throw RangeError('Plan requires 1–32 script-reference changes only');
 const keys=['kind','index','expectedRaw','targetKind','targetIndex'];
 for(const change of plan.changes){
  if(!change||Array.isArray(change)||
     Object.keys(change).sort().join(',')!==[...keys].sort().join(','))
   throw RangeError('Script-reference plan has unsupported fields');
 }
 return plan.changes;
}
export async function inspectLocalCubeScriptTransaction(argv){
 const args=parseLocalCubeScriptTransactionArgs(argv);
 const rom=await readStableLocalFile(args['--rom'],64*1024*1024);
 const digest=createHash('sha256').update(rom).digest('hex');
 if(digest!==args['--expected-sha256'].toLowerCase())
  throw RangeError('ROM differs from user-declared exact SHA-256');
 const metadata=await readStableLocalFile(args['--metadata'],4*1024*1024);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(metadata);
 const summary=inspectHmaMapBankAnchorSources(
  [{name:'local-cube-metadata',text}],{romSize:rom.length});
 if(summary.status!=='custom-candidate'||summary.uniqueDeclarationCount!==1)
  throw RangeError('Unambiguous CUBE custom metadata declaration required');
 const changes=parsePlan(await readStableLocalFile(args['--plan'],64*1024));
 const options={bankIndex:Number(args['--bank-index']),
  mapIndex:Number(args['--map-index']),mapCount:Number(args['--map-count'])};
 const inventory=inspectHmaCubeScriptReferences(rom,summary,options);
 const plan=previewHmaCubeScriptRetargetBatch(rom,summary,{...options,changes});
 const rehearsal=verifyHmaCubeScriptRetargetDryRun(rom,summary,{...options,changes});
 if(rehearsal.changedBytes!==plan.changedBytes||
    rehearsal.changedRecords!==plan.changedRecords)
  throw RangeError('Script transaction plan and rollback disagree');
 const ownership=args['--banks']===undefined?null:auditHmaCubeEditOwnershipImpact(
  rom,summary,{...options,scripts:changes,banks:parseDeclaredBanks(
   args['--banks'],options.bankIndex,options.mapCount)});
 const reread=await readStableLocalFile(args['--rom'],64*1024*1024);
 if(createHash('sha256').update(reread).digest('hex')!==digest)
  throw RangeError('Local ROM changed during script transaction');
 return Object.freeze({
  schema:'cube-mobile-local-script-transaction-smoke/1',
  userDeclaredRomHashMatched:true,customMetadataFormatRecognized:true,
  scriptReferenceCount:inventory.scriptBearingCount,
  hiddenItemUnionsProtected:inventory.hiddenItemUnionCount,
  changedReferences:rehearsal.changedRecords,
  changedBytes:rehearsal.changedBytes,
  completeEventReDecodeVerified:rehearsal.completeEventReDecodeVerified,
  rollbackVerified:rehearsal.inMemoryRollbackVerified,
  sourcePreserved:rehearsal.sourceBytesPreserved,
  boundedOwnershipInspected:ownership!==null,
  declaredOwnershipMaps:ownership?.inspectedMaps??0,
  editedByteOwnershipConflicts:ownership?.conflicts.length??null,
  ownershipCensusIncomplete:ownership?.censusIncomplete??null,
  mapScriptOwnershipIssueCount:ownership?.mapScriptIssueCount??null,
  globalPointerOwnershipProven:false,
  romModified:false,romExported:false,patchExported:false,
  independentlyAuthenticated:false,scriptSemanticsVerified:false,
  exclusiveOwnershipProven:false,emulatorVerified:false,
  androidHardwareVerified:false,writeAuthorized:false,
  independentParityEvidence:false,
  warning:'User-provided ROM hash and metadata are not independent CUBE authentication. This is copy-only script-reference rehearsal and optional partial cross-bank ownership census, not save/reopen or gameplay acceptance.'
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{process.stdout.write(JSON.stringify(
  await inspectLocalCubeScriptTransaction(process.argv.slice(2)),null,2)+'\n');}
 catch(error){
  const message=error instanceof RangeError?error.message:
   'Could not safely verify local script transaction inputs';
  process.stderr.write('Local CUBE script transaction refused: '+message+'\n');
  process.exitCode=2;
 }
}
