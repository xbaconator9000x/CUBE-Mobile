#!/usr/bin/env node
/**
 * Opt-in local-only CUBE ROM + ordered TOML identity smoke.
 * The JSON manifest is supplied by the caller, NOT curated authentication.
 * Emits no ROM bytes, metadata bytes, file paths, addresses or digests.
 */
import {readFile,stat} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {RomModel} from '../src/core.js';
import {fingerprintRomSha256} from '../src/rom-fingerprint.js';
import {fingerprintMetadataFiles} from '../src/metadata-fingerprint.js';
import {compareHmaMetadataManifest,validateHmaMetadataManifests}
  from '../src/hma-metadata-manifest.js';

export function parseLocalHmaManifestArgs(argv){
 if(!Array.isArray(argv)||argv.length<6||argv.length>36||argv.length%2!==0)
  throw new RangeError('Usage: --rom <local.gba> --manifest <local.json> --metadata <first.toml> [--metadata <next.toml> ...]');
 let rom=null,manifest=null;const metadata=[];
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(typeof value!=='string'||!value||value.includes('\0'))
   throw new RangeError('Invalid local manifest smoke argument');
  if(key==='--rom'&&!rom)rom=value;
  else if(key==='--manifest'&&!manifest)manifest=value;
  else if(key==='--metadata')metadata.push(value);
  else throw new RangeError('Invalid or repeated local manifest smoke argument');
 }
 if(!rom||!manifest||metadata.length<1||metadata.length>16)
  throw new RangeError('ROM, manifest and 1–16 ordered metadata files are required');
 const names=metadata.map(path=>basename(path).toLowerCase());
 if(new Set(names).size!==names.length)
  throw new RangeError('Repeated metadata basename in local file set');
 return Object.freeze({rom,manifest,metadata:Object.freeze(metadata)});
}
async function boundedRead(path,max){
 const before=await stat(path);
 if(!before.isFile()||before.size<1||before.size>max)
  throw new RangeError('Local input exceeds size budget');
 const bytes=await readFile(path);
 const after=await stat(path);
 if(bytes.length!==before.size||after.size!==before.size||
    after.mtimeMs!==before.mtimeMs)
  throw new RangeError('Local input changed while reading');
 return bytes;
}
export async function inspectLocalHmaManifest(argv){
 const args=parseLocalHmaManifestArgs(argv);
 const manifestBytes=await boundedRead(args.manifest,128*1024);
 let manifest;
 try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes));}
 catch(_error){throw new RangeError('Manifest is not valid UTF-8 JSON');}
 const registry=validateHmaMetadataManifests([manifest]);
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
 return Object.freeze({
  schema:'cube-mobile-local-ordered-hma-manifest-smoke/1',
  status:checked.status,exactFileSetMatch:checked.exactFileSetMatch,
  metadataFilesProvided:records.length,
  manifestFilesDeclared:registry[0].files.length,
  romModified:false,romExported:false,metadataExported:false,
  independentlyAuthenticated:false,cubeLayoutAuthenticated:false,
  safeSemanticEditingVerified:false,romSaveReopenVerified:false,
  emulatorVerified:false,androidHardwareVerified:false,
  independentParityEvidence:false,
  warning:'Caller-supplied exact-byte manifest evidence is not independently curated CUBE compatibility or permission to edit.'
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
