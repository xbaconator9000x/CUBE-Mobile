#!/usr/bin/env node
/**
 * Local-only, SHA-256-matched raw CUBHMA map-bank table smoke.
 * User-provided expected hash is NOT independently curated authentication.
 * Emits aggregate counts only: never ROM bytes, addresses or local paths.
 */
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaDeclaredBankPointerTable} from '../src/hma-map-bank-declared-table.js';
import {inspectHmaDeclaredBankTargetWindows} from '../src/hma-map-bank-target-windows.js';

const SHA=/^[0-9a-f]{64}$/i;
export function parseLocalCubeBankSmokeArgs(argv){
 if(!Array.isArray(argv)||![6,8].includes(argv.length))
  throw new RangeError('Usage: --rom <local.gba> --metadata <local.toml> --expected-sha256 <64 hex>');
 const options={};
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(!['--rom','--metadata','--expected-sha256','--target-words'].includes(key)||
     Object.hasOwn(options,key)||typeof value!=='string'||!value)
    throw new RangeError('Invalid local smoke arguments');
  options[key]=value;
 }
 if(!options['--rom']||!options['--metadata']||
    !SHA.test(options['--expected-sha256']||'')||
    (options['--target-words']!==undefined&&
     !/^(?:[1-9]|1[0-6])$/.test(options['--target-words'])))
  throw new RangeError('ROM, metadata and separately supplied exact SHA-256 are required');
 return options;
}
async function boundedRead(path,max){
 const before=await stat(path);
 if(!before.isFile()||before.size<1||before.size>max)
  throw new RangeError('Local input exceeds size budget');
 const bytes=await readFile(path);
 if(bytes.length!==before.size)
  throw new RangeError('Local input changed while reading');
 return bytes;
}
export async function inspectLocalCubeBankSmoke(argv){
 const args=parseLocalCubeBankSmokeArgs(argv);
 const rom=await boundedRead(args['--rom'],128*1024*1024);
 const digest=createHash('sha256').update(rom).digest('hex');
 if(digest!==args['--expected-sha256'].toLowerCase())
  throw new RangeError('ROM SHA-256 differs from separately supplied expectation');
 const toml=await boundedRead(args['--metadata'],4*1024*1024);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(toml);
 const metadata=inspectHmaMapBankAnchorSources([{name:'local-metadata',text}],{romSize:rom.length});
 if(!['custom-candidate','vanilla-marker'].includes(metadata.status))
  throw new RangeError('No unambiguous bounded map-bank metadata declaration');
 const reader={length:rom.length,read:index=>rom[index]};
 const table=inspectHmaDeclaredBankPointerTable(reader,metadata);
 const targets=args['--target-words']===undefined?null:
   inspectHmaDeclaredBankTargetWindows(reader,metadata,
     {wordsPerTarget:Number(args['--target-words'])});
 return Object.freeze({
  schema:'cube-mobile-local-cube-bank-table-smoke/2',
  hashMatchedUserDeclaration:true,
  metadataDeclarationStatus:metadata.status,
  declaredPointerSlots:table.declaredBankCount,
  conventionalPointerWords:table.conventionalCount,
  inRomPointerWords:table.inRomCount,
  repeatedTargets:table.duplicateTargetCount,
  unalignedTargets:table.unalignedCount,
  targetsInsideDeclaredTable:table.insideTableCount,
  ...(targets?{
    rawTargetWindowWords:targets.wordsPerTarget,
    rawTargetsSampled:targets.sampledTargets,
    rawNestedPointerShapedWords:targets.conventionalNestedWords,
    rawNestedInRomPointerWords:targets.inRomNestedWords,
    rawTargetOverlapSkips:targets.tableOverlaps+targets.overlappingWindows,
    rawTargetTruncationSkips:targets.truncatedTargets,
    rawTargetMisalignedSkips:targets.misalignedTargets,
    rawTargetInvalidSkips:targets.invalidTargets,
    rawTargetDuplicateSkips:targets.duplicateTargets
  }:{}),
  readOnly:true,romModified:false,romExported:false,
  independentlyAuthenticated:false,cubeLayoutAuthenticated:false,
  safeSemanticEditingVerified:false,romSaveReopenVerified:false,
  emulatorVerified:false,androidHardwareVerified:false,
  independentParityEvidence:false,
  warning:'Only user-SHA-matched metadata-declared raw pointer evidence. Optional nested raw windows do not decode CUBE maps or establish strict parity.'
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const report=await inspectLocalCubeBankSmoke(process.argv.slice(2));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
 }catch(error){
  const message=error instanceof RangeError?error.message:
   'Could not safely inspect local ROM and metadata inputs';
  process.stderr.write('Local CUBE bank smoke refused: '+message+'\n');
  process.exitCode=2;
 }
}
