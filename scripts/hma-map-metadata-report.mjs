#!/usr/bin/env node
/**
 * Opt-in local CUBHMA map-bank metadata report.
 * Reads TOML only. No ROM upload, ROM mutation, network calls or CUBE trust.
 */
import {readFile,stat} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectHmaMapBankAnchorSources} from '../src/hma-map-bank-metadata.js';

const MAX_FILE_BYTES=4*1024*1024;
const MAX_TOTAL_BYTES=16*1024*1024;
const MAX_FILES=64;

export function parseMapMetadataCliArgs(argv){
  if(!Array.isArray(argv))throw new TypeError('Expected CLI arguments');
  let romSize=Infinity,hasSize=false;
  const files=[];
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--rom-size'){
      if(hasSize||i+1>=argv.length||!/^\d+$/.test(argv[i+1]))
        throw new RangeError('Use --rom-size once with a decimal byte length');
      romSize=Number(argv[++i]);hasSize=true;
      if(!Number.isSafeInteger(romSize)||romSize<0||romSize>128*1024*1024)
        throw new RangeError('ROM length must be 0–134217728 bytes');
    }else if(typeof arg==='string'&&arg&&!arg.startsWith('--')){
      files.push(arg);
    }else throw new RangeError('Unknown option: '+String(arg));
  }
  if(!files.length||files.length>MAX_FILES)
    throw new RangeError('Provide 1–64 local TOML files');
  return {romSize,files};
}

export async function inspectLocalHmaMapMetadata(argv){
  const {romSize,files}=parseMapMetadataCliArgs(argv);
  const sources=[];
  let totalBytes=0;
  for(let i=0;i<files.length;i++){
    const info=await stat(files[i]);
    if(!info.isFile()||info.size>MAX_FILE_BYTES||info.size<0||
       totalBytes+info.size>MAX_TOTAL_BYTES)
      throw new RangeError('TOML file or aggregate size exceeds local budget');
    const bytes=await readFile(files[i]);
    if(bytes.length!==info.size||bytes.length>MAX_FILE_BYTES)
      throw new RangeError('TOML file changed during inspection');
    totalBytes+=bytes.length;
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    sources.push({name:String(i+1)+':'+basename(files[i]),text});
  }
  const report=inspectHmaMapBankAnchorSources(sources,{romSize});
  return Object.freeze({
    status:report.status,
    sourceCount:sources.length,metadataBytes:totalBytes,
    anchorName:report.anchorName,
    declarationCount:report.declarationCount,
    uniqueDeclarationCount:report.uniqueDeclarationCount,
    declarations:report.declarations.map(d=>({
      source:d.source,line:d.line,address:d.address,
      formatLength:d.format.length,addressInBounds:d.addressInBounds
    })),
    hierarchy:report.hierarchy?{
      status:report.hierarchy.status,
      sectionNames:Object.entries(report.hierarchy.sections)
        .filter(([,value])=>value!==null).map(([name])=>name),
      vanillaMarker:report.hierarchy.vanillaMarker
    }:null,
    romAuthenticated:false,cubeLayoutAuthenticated:false,
    writeAuthorized:false
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    const report=await inspectLocalHmaMapMetadata(process.argv.slice(2));
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(!['custom-candidate','vanilla-marker'].includes(report.status))
      process.exitCode=2;
  }catch(err){
    process.stderr.write('Metadata inspection refused: '+err.message+'\n');
    process.exitCode=2;
  }
}
