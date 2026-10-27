/**
 * Bounded read-only script target alias audit spanning 16-map atlas pages.
 * Provenance: pinned CUBHMA MapModel.cs vanilla map/event pointer layouts.
 * This is a structural hint, not authenticated CUBE script ownership.
 */
import {inspectVanillaEventScriptPointers} from './map-events.js';
import {inspectVanillaMapHeader} from './map-layouts.js';

function crossPageReader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected ROM bytes or read-only ROM accessor');
}
function crossPagePointer(rom,offset){
 if(!Number.isSafeInteger(offset)||offset<0||offset>rom.length-4)
  throw new RangeError('Map pointer source outside ROM');
 let raw=0;
 for(let i=0;i<4;i++){
  const n=rom.read(offset+i);
  if(!Number.isInteger(n)||n<0||n>255)
   throw new RangeError('Invalid ROM accessor byte');
  raw+=n*2**(8*i);
 }
 return raw;
}
/**
 * Scan at most 256 contiguous declared maps in one bounded operation.
 * Detects aliases across the UI's 16-map page boundary, unlike a page-only
 * audit. A truncated scan does not claim to cover the entire atlas.
 */
export function auditVanillaScriptAliasesAcrossPages(source,atlas,{
 startMap=0,maxMaps=64,maxPointerFields=4096,maxGroups=64,maxReferences=16
}={}){
 const rom=crossPageReader(source);
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
    atlas.maps.length<1||atlas.maps.length>4096)
  throw new TypeError('A declared read-only vanilla atlas is required');
 if(!Number.isSafeInteger(startMap)||startMap<0||startMap>=atlas.maps.length||
    !Number.isSafeInteger(maxMaps)||maxMaps<1||maxMaps>256||
    !Number.isSafeInteger(maxPointerFields)||maxPointerFields<1||maxPointerFields>16384||
    !Number.isSafeInteger(maxGroups)||maxGroups<1||maxGroups>128||
    !Number.isSafeInteger(maxReferences)||maxReferences<1||maxReferences>32)
  throw new RangeError('Invalid bounded script alias audit limits');
 const page=atlas.maps.slice(startMap,startMap+maxMaps);
 const buckets=new Map();
 let pointerFields=0,inRomPointers=0;
 for(let index=0;index<page.length;index++){
  const map=page[index],ordinal=startMap+index;
  if(!Number.isSafeInteger(map.mapHeaderOffset)||map.mapHeaderOffset<0||
     map.mapHeaderOffset>=0x02000000||
     !Number.isSafeInteger(map.bankIndex)||map.bankIndex<0||
     !Number.isSafeInteger(map.mapIndex)||map.mapIndex<0)
   throw new RangeError('Invalid declared map provenance');
  if(crossPagePointer(rom,map.mapPointerSource)!==0x08000000+map.mapHeaderOffset)
   throw new RangeError('Declared map pointer changed');
  const header=inspectVanillaMapHeader(rom,{
   address:map.mapHeaderOffset,family:atlas.family
  });
  if(header.layoutOffset!==map.layoutOffset||
     header.layout.blockmapOffset!==map.blockmapOffset||
     header.layout.width!==map.width||header.layout.height!==map.height)
   throw new RangeError('Declared map layout changed');
  const inspection=inspectVanillaEventScriptPointers(rom,{
   address:map.mapHeaderOffset,family:atlas.family
  });
  if(pointerFields+inspection.records.length>maxPointerFields)
   throw new RangeError('Script pointer budget exceeded; scan fewer maps');
  pointerFields+=inspection.records.length;
  for(const record of inspection.records){
   if(record.status!=='in-rom')continue;
   inRomPointers++;
   let bucket=buckets.get(record.targetOffset);
   if(!bucket){
    bucket={targetOffset:record.targetOffset,referenceCount:0,
     firstMapOrdinal:ordinal,lastMapOrdinal:ordinal,references:[]};
    buckets.set(record.targetOffset,bucket);
   }
   bucket.referenceCount++;
   bucket.lastMapOrdinal=ordinal;
   if(bucket.references.length<maxReferences)
    bucket.references.push(Object.freeze({
     bankIndex:map.bankIndex,mapIndex:map.mapIndex,
     kind:record.kind,index:record.index,
     pointerSourceOffset:record.sourceOffset
    }));
  }
 }
 const all=[...buckets.values()].filter(x=>x.referenceCount>1)
  .sort((a,b)=>a.targetOffset-b.targetOffset);
 const groups=all.slice(0,maxGroups).map(group=>Object.freeze({
  targetOffset:group.targetOffset,referenceCount:group.referenceCount,
  firstMapOrdinal:group.firstMapOrdinal,lastMapOrdinal:group.lastMapOrdinal,
  crossesSixteenMapPage:Math.floor(group.firstMapOrdinal/16)!==
   Math.floor(group.lastMapOrdinal/16),
  references:Object.freeze(group.references),
  referencesTruncated:group.referenceCount>group.references.length
 }));
 return Object.freeze({
  startMap,mapsInspected:page.length,totalMaps:atlas.maps.length,
  nextStartMap:startMap+page.length<atlas.maps.length?startMap+page.length:null,
  pointerFields,inRomPointers,totalGroups:all.length,
  groups:Object.freeze(groups),truncated:all.length>groups.length,
  readOnly:true,layoutAuthenticated:false,ownershipAuthenticated:false,
  crossScanBoundaryAliasesUnknown:true,controlFlowFollowed:false,
  writeAuthorized:false,independentParityEvidence:false
 });
}
