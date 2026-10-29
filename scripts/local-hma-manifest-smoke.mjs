#!/usr/bin/env node
/**
 * Opt-in local-only CUBE ROM + ordered TOML identity smoke.
 * The JSON manifest is supplied by the caller, NOT curated authentication.
 * Emits no ROM bytes, metadata bytes, file paths, addresses or digests.
 */
import {readStableLocalFile} from './local-input-safety.mjs';
import {compareRomHmaProvenance} from '../src/hma-rom-provenance-binding.js';
import {validateRomProfileRegistry} from '../src/rom-compatibility.js';
import {validateLocalOrderedProfileOverlay,compareLocalOrderedProfileOverlay}
 from '../src/hma-ordered-profile.js';
import {basename,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';
import {fingerprintMetadataFiles} from '../src/metadata-fingerprint.js';
import {compareHmaMetadataManifest,validateHmaMetadataManifests}
  from '../src/hma-metadata-manifest.js';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';
import {inspectHmaDeclaredBankPointerTable} from '../src/hma-map-bank-declared-table.js';
import {inspectHmaDeclaredBankTargetWindows} from '../src/hma-map-bank-target-windows.js';

export function parseLocalHmaManifestArgs(argv){
 if(!Array.isArray(argv)||argv.length<6||argv.length>40||argv.length%2!==0)
  throw new RangeError('Usage: --rom <local.gba> --manifest <local.json> --metadata <first.toml> [--metadata <next.toml> ...]');
 let rom=null,manifest=null,profile=null,targetWords=null;const metadata=[];
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(typeof value!=='string'||!value||value.includes('\0'))
   throw new RangeError('Invalid local manifest smoke argument');
  if(key==='--rom'&&!rom)rom=value;
  else if(key==='--manifest'&&!manifest)manifest=value;
  else if(key==='--metadata')metadata.push(value);
  else if(key==='--profile'&&!profile)profile=value;
  else if(key==='--target-words'&&targetWords===null&&/^(?:[1-9]|1[0-6])$/.test(value))
   targetWords=Number(value);
  else throw new RangeError('Invalid or repeated local manifest smoke argument');
 }
 if(!rom||!manifest||metadata.length<1||metadata.length>16)
  throw new RangeError('ROM, manifest and 1–16 ordered metadata files are required');
 const paths=[rom,manifest,...(profile?[profile]:[]),...metadata].map(path=>resolve(path));
 if(new Set(paths).size!==paths.length)
  throw new RangeError('Local ROM, manifest, profile and metadata paths must be distinct');
 const names=metadata.map(path=>basename(path).toLowerCase());
 if(new Set(names).size!==names.length)
  throw new RangeError('Repeated metadata basename in local file set');
 return Object.freeze({rom,manifest,profile,targetWords,metadata:Object.freeze(metadata)});
}
async function boundedRead(path,max){
 // Unlike stat/readFile/stat, this rejects symlink traversal and checks
 // descriptor + pathname inode, size, mtime and ctime around the read.
 return readStableLocalFile(path,max);
}
export async function inspectLocalHmaManifest(argv){
 const args=parseLocalHmaManifestArgs(argv);
 const manifestBytes=await boundedRead(args.manifest,128*1024);
 let manifest;
 try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));}
 catch(_error){throw new RangeError('Manifest is not valid UTF-8 JSON');}
 const registry=validateHmaMetadataManifests([manifest]);
 let profiles=null,orderedProfile=null;
 if(args.profile){
  const bytes=await boundedRead(args.profile,128*1024);
  let profile;
  try{profile=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch(_error){throw new RangeError('ROM profile is not valid UTF-8 JSON');}
  profiles=validateRomProfileRegistry([profile]);
  orderedProfile=validateLocalOrderedProfileOverlay(profile);
 }
 const rom=await boundedRead(args.rom,128*1024*1024);
 const model=new RomModel('local-rom',rom);
 const fingerprint=await fingerprintRomSha256(model);
 const files=[];
 let total=0;
 for(const path of args.metadata){
  const bytes=await boundedRead(path,4*1024*1024);
  total+=bytes.length;
  if(total>16*1024*1024)throw new RangeError('Metadata exceeds aggregate size budget');
  files.push({name:basename(path),bytes});
 }
 const records=fingerprintMetadataFiles(files);
 const checked=compareHmaMetadataManifest(model,fingerprint,records,{manifests:registry});
 const cross=profiles?compareRomHmaProvenance(model,fingerprint,records,
  {profiles,manifests:registry}):null;
 const orderedResult=cross?.status==='multi-file-profile-unbound'&&orderedProfile?
  compareLocalOrderedProfileOverlay(orderedProfile,registry[0],records):null;
 const crossSourceStatus=orderedResult?.status||cross?.status||'not-requested';
 const crossSourceClaimsConsistent=crossSourceStatus==='consistent-exact-byte-claims'||
  crossSourceStatus==='consistent-ordered-byte-claims';
 let bank=null;
 if(args.targetWords!==null){
  if(checked.status!=='exact-file-set-match')
   throw new RangeError('Ordered file set does not match supplied manifest; bank inspection refused');
  if(cross&&!crossSourceClaimsConsistent)
   throw new RangeError('Cross-source ROM/TOML claims are not consistent; bank inspection refused');
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const sources=files.map(file=>({name:file.name,text:decoder.decode(file.bytes)}));
  const metadata=inspectHmaMapBankAnchorSources(sources,{romSize:rom.length});
  if(!['custom-candidate','vanilla-marker'].includes(metadata.status))
   throw new RangeError('Unambiguous metadata-declared bank structure not available');
  const reader={length:rom.length,read:index=>rom[index]};
  const table=inspectHmaDeclaredBankPointerTable(reader,metadata);
  const targets=inspectHmaDeclaredBankTargetWindows(reader,metadata,
   {wordsPerTarget:args.targetWords});
  bank={bankMetadataStatus:metadata.status,declaredPointerSlots:table.declaredBankCount,
   inRomPointerWords:table.inRomCount,rawTargetsSampled:targets.sampledTargets,
   rawTargetWindowWords:targets.wordsPerTarget,
   rawNestedPointerShapedWords:targets.conventionalNestedWords,
   rawNestedInRomPointerWords:targets.inRomNestedWords,
   rawTargetOverlapSkips:targets.tableOverlaps+targets.overlappingWindows,
   rawTargetTruncationSkips:targets.truncatedTargets,
   rawTargetInvalidSkips:targets.invalidTargets};
 }
 return Object.freeze({
  schema:'cube-mobile-local-ordered-hma-manifest-smoke/1',
  status:checked.status,exactFileSetMatch:checked.exactFileSetMatch,
  metadataFilesProvided:records.length,
  manifestFilesDeclared:registry[0].files.length,
  separateProfileProvided:!!profiles,orderedProfileProvided:!!orderedProfile,
  crossSourceStatus,crossSourceClaimsConsistent,
  ...(bank||{}),
  romModified:false,romExported:false,metadataExported:false,
  independentlyAuthenticated:false,cubeLayoutAuthenticated:false,
  safeSemanticEditingVerified:false,romSaveReopenVerified:false,
  emulatorVerified:false,androidHardwareVerified:false,
  independentParityEvidence:false,
  warning:'Caller-supplied exact-byte ROM profile, optional ordered profile overlay, ordered TOML manifest and raw bank census are consistency checks only; they do not authenticate CUBE maps or permit semantic editing.'
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const report=await inspectLocalHmaManifest(process.argv.slice(2));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
 }catch(error){
  const message=error instanceof RangeError?error.message:
   'Could not safely inspect local ROM and ordered metadata';
  process.stderr.write('Local HMA manifest smoke refused: '+message+'\n');
  process.exitCode=2;
 }
}
