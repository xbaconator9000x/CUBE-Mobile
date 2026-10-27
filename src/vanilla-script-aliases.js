/**
 * Bounded, read-only alias audit for vanilla object/trigger script pointers.
 * Two records targeting the same ROM offset may intentionally share a script.
 * This is not script allocation ownership, CUBE grammar authentication,
 * a control-flow traversal or permission to edit shared bytes.
 */
import {inspectVanillaEventScriptPointers} from './map-events.js';
import {inspectVanillaMapHeader} from './map-layouts.js';

function scriptAliasReader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected ROM bytes or a read-only accessor');
}
function scriptAliasReadPointer(rom,offset){
 if(!Number.isSafeInteger(offset)||offset<0||offset>rom.length-4)
  throw new RangeError('Atlas map pointer source outside ROM');
 let value=0;
 for(let i=0;i<4;i++){
  const n=rom.read(offset+i);
  if(!Number.isInteger(n)||n<0||n>255)
   throw new RangeError('Invalid ROM byte in atlas pointer');
  value+=n*2**(8*i);
 }
 return value;
}
export function auditVanillaAtlasScriptAliases(source,atlas,{
 startMap=0,maxMaps=16,maxGroups=32,maxReferences=16
}={}){
 const rom=scriptAliasReader(source);
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
    atlas.maps.length<1||atlas.maps.length>4096)
  throw new TypeError('A declared read-only vanilla atlas is required');
 if(!Number.isSafeInteger(startMap)||startMap<0||startMap>=atlas.maps.length||
    !Number.isSafeInteger(maxMaps)||maxMaps<1||maxMaps>32||
    !Number.isSafeInteger(maxGroups)||maxGroups<1||maxGroups>64||
    !Number.isSafeInteger(maxReferences)||maxReferences<1||maxReferences>32)
  throw new RangeError('Invalid bounded atlas script alias page');
 const page=atlas.maps.slice(startMap,startMap+maxMaps);
 const pointers=new Map();
 let pointerFields=0,inRomPointers=0;
 for(const map of page){
  if(!Number.isSafeInteger(map.mapHeaderOffset)||map.mapHeaderOffset<0||
     map.mapHeaderOffset>=0x02000000||
     !Number.isSafeInteger(map.bankIndex)||map.bankIndex<0||
     !Number.isSafeInteger(map.mapIndex)||map.mapIndex<0)
   throw new RangeError('Invalid declared map provenance');
  if(scriptAliasReadPointer(rom,map.mapPointerSource)!==0x08000000+map.mapHeaderOffset)
   throw new RangeError('Declared map header pointer is stale');
  const header=inspectVanillaMapHeader(rom,{
   address:map.mapHeaderOffset,family:atlas.family});
  if(header.layoutOffset!==map.layoutOffset||
     header.layout.blockmapOffset!==map.blockmapOffset||
     header.layout.width!==map.width||header.layout.height!==map.height)
   throw new RangeError('Declared map layout is stale');
  const inspection=inspectVanillaEventScriptPointers(rom,{
   address:map.mapHeaderOffset,family:atlas.family});
  for(const p of inspection.records){
   pointerFields++;
   if(p.status!=='in-rom')continue;
   inRomPointers++;
   const refs=pointers.get(p.targetOffset)||[];
   refs.push(Object.freeze({bankIndex:map.bankIndex,mapIndex:map.mapIndex,
    kind:p.kind,index:p.index,pointerSourceOffset:p.sourceOffset}));
   pointers.set(p.targetOffset,refs);
  }
 }
 const groups=[];let totalGroups=0;
 for(const [targetOffset,refs] of pointers){
  if(refs.length<2)continue;
  totalGroups++;
  if(groups.length<maxGroups)groups.push(Object.freeze({
   targetOffset,referenceCount:refs.length,
   references:Object.freeze(refs.slice(0,maxReferences)),
   referencesTruncated:refs.length>maxReferences
  }));
 }
 groups.sort((a,b)=>a.targetOffset-b.targetOffset);
 return Object.freeze({
  startMap,mapsInspected:page.length,totalMaps:atlas.maps.length,
  nextStartMap:startMap+page.length<atlas.maps.length?startMap+page.length:null,
  pointerFields,inRomPointers,totalGroups,
  groups:Object.freeze(groups),truncated:totalGroups>groups.length,
  readOnly:true,layoutAuthenticated:false,ownershipAuthenticated:false,
  controlFlowFollowed:false,writeAuthorized:false,independentParityEvidence:false
 });
}
