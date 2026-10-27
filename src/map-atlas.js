/**
 * Explicit read-only vanilla RSE/FRLG map atlas.
 * Upstream: kcradi/CUBHMA MapModel.cs AllMapsModel/MapBankModel.
 * Counts come from the user, never inferred from headers or sentinel scans.
 * This does not authenticate CUBE expansion layouts or permit ROM writes.
 */
import {inspectVanillaMapBankEntry} from './map-discovery.js';

export function parseVanillaBankMapCounts(text) {
 if(typeof text!=='string'||!/^\s*\d+(?:\s*[,\s]\s*\d+)*\s*$/.test(text))
  throw new RangeError('Enter comma-separated decimal map counts, one per bank');
 const parts=text.trim().split(/[\s,]+/);
 if(parts.length<1||parts.length>256)throw new RangeError('Declare 1–256 vanilla banks');
 const counts=parts.map(Number);
 if(counts.some(n=>!Number.isSafeInteger(n)||n<1||n>1024))
  throw new RangeError('Each declared bank must have 1–1024 maps');
 return Object.freeze(counts);
}
export function inspectVanillaMapAtlas(source,{address,bankMapCounts,family,maxMaps=4096}={}) {
 if(!Array.isArray(bankMapCounts)||bankMapCounts.length<1||bankMapCounts.length>256)
  throw new RangeError('Explicit map counts required for 1–256 banks');
 if(!Number.isSafeInteger(maxMaps)||maxMaps<1||maxMaps>4096)
  throw new RangeError('Atlas map limit must be 1–4096');
 let total=0;
 for(const n of bankMapCounts){
  if(!Number.isSafeInteger(n)||n<1||n>1024)
   throw new RangeError('Each declared bank must have 1–1024 maps');
  total+=n;
  if(total>maxMaps)throw new RangeError('Declared map catalog exceeds bounded map limit');
 }
 const maps=[],banks=[];
 for(let bankIndex=0;bankIndex<bankMapCounts.length;bankIndex++){
  const mapCount=bankMapCounts[bankIndex];
  const first=inspectVanillaMapBankEntry(source,{address,bankCount:bankMapCounts.length,
   bankIndex,mapCount,mapIndex:0,family});
  for(const bank of banks){
   if(first.bankOffset<bank.bankOffset+bank.mapCount*4 &&
      bank.bankOffset<first.bankOffset+mapCount*4)
    throw new RangeError('Declared map-bank pointer arrays overlap');
  }
  banks.push(Object.freeze({bankIndex,mapCount,bankOffset:first.bankOffset,
   bankPointerSource:first.bankPointerSource}));
  for(let mapIndex=0;mapIndex<mapCount;mapIndex++){
   const result=mapIndex===0?first:inspectVanillaMapBankEntry(source,{
    address,bankCount:bankMapCounts.length,bankIndex,mapCount,mapIndex,family});
   maps.push(Object.freeze({bankIndex,mapIndex,mapHeaderOffset:result.mapHeaderOffset,
    mapPointerSource:result.mapPointerSource,layoutOffset:result.header.layoutOffset,
    blockmapOffset:result.header.layout.blockmapOffset,width:result.header.layout.width,
    height:result.header.layout.height}));
  }
 }
 return Object.freeze({address,family,bankMapCounts:Object.freeze([...bankMapCounts]),
  bankCount:banks.length,mapCount:maps.length,banks:Object.freeze(banks),
  maps:Object.freeze(maps),readOnly:true,layoutAuthenticated:false});
}
export function lookupVanillaMapAtlasTarget(atlas,bankIndex,mapIndex) {
 if(!atlas||!Array.isArray(atlas.maps))throw new TypeError('Expected inspected atlas');
 if(!Number.isSafeInteger(bankIndex)||!Number.isSafeInteger(mapIndex)||
    bankIndex<0||mapIndex<0)return null;
 return atlas.maps.find(m=>m.bankIndex===bankIndex&&m.mapIndex===mapIndex)||null;
}

/**
 * Bounded structural probe near a USER-SUPPLIED approximate bank table offset.
 * Only a small explicitly counted subset of vanilla maps is tested.
 * A candidate is not an authenticated ROM identity or CUBE layout.
 */
export function probeVanillaMapBankTables(source,{
 start,bytes=1024,bankMapCounts,family,maxCandidates=16
}={}){
 if(!source||!Number.isSafeInteger(source.length)||source.length<0||
    !(source instanceof Uint8Array)&&typeof source.read!=='function')
  throw new TypeError('Expected ROM bytes or a staged read-only ROM accessor');
 if(!['RSE','FRLG'].includes(family))throw new RangeError('Explicit vanilla family required');
 if(!Array.isArray(bankMapCounts)||bankMapCounts.length<1||bankMapCounts.length>16||
    bankMapCounts.some(n=>!Number.isSafeInteger(n)||n<1||n>128)||
    bankMapCounts.reduce((a,b)=>a+b,0)>128)
  throw new RangeError('Probe requires 1–16 banks and at most 128 explicitly counted maps');
 if(!Number.isSafeInteger(start)||start<0||start%4||
    !Number.isSafeInteger(bytes)||bytes<bankMapCounts.length*4||
    bytes>4096||bytes%4||start>source.length-bytes)
  throw new RangeError('Probe window must be aligned, inside ROM and at most 4096 bytes');
 if(!Number.isSafeInteger(maxCandidates)||maxCandidates<1||maxCandidates>32)
  throw new RangeError('Candidate cap must be 1–32');
 const candidates=[];let matches=0;
 const end=start+bytes-bankMapCounts.length*4;
 for(let address=start;address<=end;address+=4){
  try{
   const atlas=inspectVanillaMapAtlas(source,{
    address,bankMapCounts,family,maxMaps:128
   });
   matches++;
   if(candidates.length<maxCandidates)candidates.push(Object.freeze({
    address,declaredBanks:atlas.bankCount,checkedMaps:atlas.mapCount,
    firstHeaderOffset:atlas.maps[0].mapHeaderOffset,
    readOnly:true,layoutAuthenticated:false
   }));
  }catch(err){
   if(!(err instanceof RangeError))throw err;
  }
 }
 return Object.freeze({
  start,bytes,checkedOffsets:(end-start)/4+1,matches,
  truncated:matches>candidates.length,
  candidates:Object.freeze(candidates),readOnly:true,layoutAuthenticated:false
 });
}

/**
 * Read-only pointer alias inventory for an already inspected vanilla atlas.
 * Shared headers/layouts/blockmaps can be intentional; this reports ownership
 * questions before any future semantic write or relocation.
 * Source pointers: bank map-pointer entry, map header +0, layout +12.
 */
export function auditVanillaAtlasPointerAliases(atlas,{
 maxGroups=64,maxReferences=16
}={}){
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !Array.isArray(atlas.maps)||atlas.maps.length<1||atlas.maps.length>4096||
    !['RSE','FRLG'].includes(atlas.family))
  throw new TypeError('A read-only declared vanilla atlas is required');
 if(!Number.isSafeInteger(maxGroups)||maxGroups<1||maxGroups>256)
  throw new RangeError('Group limit must be 1–256');
 if(!Number.isSafeInteger(maxReferences)||maxReferences<1||maxReferences>32)
  throw new RangeError('Reference limit must be 1–32');
 const fields=[
  ['header','mapHeaderOffset',m=>m.mapPointerSource],
  ['layout','layoutOffset',m=>m.mapHeaderOffset],
  ['blockmap','blockmapOffset',m=>m.layoutOffset+12]
 ];
 const counts={header:0,layout:0,blockmap:0};
 const groups=[];let totalGroups=0;
 for(const [kind,field,sourceOffset] of fields){
  const buckets=new Map();
  for(const m of atlas.maps){
   for(const n of [m.bankIndex,m.mapIndex,m[field],sourceOffset(m)])
    if(!Number.isSafeInteger(n)||n<0)
     throw new RangeError('Invalid map pointer provenance');
   const refs=buckets.get(m[field])||[];
   refs.push(Object.freeze({bankIndex:m.bankIndex,mapIndex:m.mapIndex,
    sourceOffset:sourceOffset(m)}));
   buckets.set(m[field],refs);
  }
  for(const [offset,refs] of buckets){
   if(refs.length<2)continue;
   counts[kind]++;totalGroups++;
   if(groups.length<maxGroups)groups.push(Object.freeze({
    kind,offset,referenceCount:refs.length,
    references:Object.freeze(refs.slice(0,maxReferences)),
    referencesTruncated:refs.length>maxReferences
   }));
  }
 }
 return Object.freeze({
  totalMaps:atlas.maps.length,counts:Object.freeze(counts),
  totalGroups,truncated:totalGroups>groups.length,
  groups:Object.freeze(groups),readOnly:true,layoutAuthenticated:false,
  ownershipAuthenticated:false
 });
}
