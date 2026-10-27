/**
 * Full declared-atlas, read-only vanilla object/trigger script target audit.
 * Source: pinned CUBHMA MapModel.cs event records and map pointer layouts.
 * Equal destinations are only structural aliases, never allocation ownership.
 */
import {inspectVanillaEventScriptPointers} from './map-events.js';
import {inspectVanillaMapBankEntry} from './map-discovery.js';

function atlasAliasReader(source) {
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected ROM bytes or read-only ROM accessor');
}
function atlasAliasPointer(rom,offset) {
 if(!Number.isSafeInteger(offset)||offset<0||offset>rom.length-4)
  throw new RangeError('Map pointer source outside ROM');
 let value=0;
 for(let i=0;i<4;i++){
  const byte=rom.read(offset+i);
  if(!Number.isInteger(byte)||byte<0||byte>255)
   throw new RangeError('Invalid ROM accessor byte');
  value+=byte*2**(8*i);
 }
 return value;
}

/**
 * Scan every explicitly declared map in a single bounded operation, including
 * aliases across arbitrary 64-map UI scan windows. Never infer map counts.
 * Fail closed rather than silently returning a partial-atlas result.
 */
export function auditVanillaAtlasWideScriptAliases(source,atlas,{
 maxMaps=4096,maxPointerFields=32768,maxGroups=64,maxReferences=16
}={}){
 const rom=atlasAliasReader(source);
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
    atlas.maps.length<1||atlas.maps.length>4096)
  throw new TypeError('A declared read-only vanilla atlas is required');
 if(!Number.isSafeInteger(maxMaps)||maxMaps<1||maxMaps>4096||
    !Number.isSafeInteger(maxPointerFields)||maxPointerFields<1||maxPointerFields>65536||
    !Number.isSafeInteger(maxGroups)||maxGroups<1||maxGroups>128||
    !Number.isSafeInteger(maxReferences)||maxReferences<1||maxReferences>32)
  throw new RangeError('Invalid atlas-wide alias audit limits');
 if(atlas.maps.length>maxMaps)
  throw new RangeError('Declared atlas exceeds scan map budget; no partial result');
 const counts=atlas.bankMapCounts;
 if(!Number.isSafeInteger(atlas.address)||atlas.address<0||
    atlas.address%4!==0||!Array.isArray(counts)||
    counts.length<1||counts.length>256||
    counts.some(n=>!Number.isSafeInteger(n)||n<1||n>1024)||
    counts.reduce((a,b)=>a+b,0)!==atlas.maps.length)
  throw new RangeError('Declared atlas has inconsistent bank-table provenance');
 const targets=new Map();
 let pointerFields=0,inRomPointers=0,expectedBank=0,expectedMap=0;
 for(let ordinal=0;ordinal<atlas.maps.length;ordinal++){
  const map=atlas.maps[ordinal];
  if(!map||![map.mapHeaderOffset,map.mapPointerSource,map.bankIndex,
      map.mapIndex,map.layoutOffset,map.blockmapOffset,map.width,map.height]
      .every(n=>Number.isSafeInteger(n)&&n>=0)||
     map.mapHeaderOffset>=0x02000000)
   throw new RangeError('Invalid declared map provenance');
  if(map.bankIndex!==expectedBank||map.mapIndex!==expectedMap)
   throw new RangeError('Declared atlas map order or bank identity changed');
  expectedMap++;
  if(expectedMap===counts[expectedBank]){expectedBank++;expectedMap=0;}
  // Re-derive the canonical bank/map source from the ROM's bank table.
  // A matching pointer value at a forged offset is not map provenance.
  const canonical=inspectVanillaMapBankEntry(rom,{
   address:atlas.address,bankCount:counts.length,
   bankIndex:map.bankIndex,mapCount:counts[map.bankIndex],
   mapIndex:map.mapIndex,family:atlas.family
  });
  if(map.mapPointerSource!==canonical.mapPointerSource||
     map.mapHeaderOffset!==canonical.mapHeaderOffset)
   throw new RangeError('Declared map pointer source or header changed');
  if(atlasAliasPointer(rom,map.mapPointerSource)!==0x08000000+map.mapHeaderOffset)
   throw new RangeError('Declared map pointer changed');
  const header=canonical.header;
  if(header.layoutOffset!==map.layoutOffset||
     header.layout.blockmapOffset!==map.blockmapOffset||
     header.layout.width!==map.width||header.layout.height!==map.height)
   throw new RangeError('Declared map layout changed');
  const inspected=inspectVanillaEventScriptPointers(rom,{
   address:map.mapHeaderOffset,family:atlas.family
  });
  pointerFields+=inspected.records.length;
  if(pointerFields>maxPointerFields)
   throw new RangeError('Script pointer budget exceeded; no partial result');
  for(const record of inspected.records){
   if(record.status!=='in-rom')continue;
   inRomPointers++;
   let group=targets.get(record.targetOffset);
   if(!group){
    group={targetOffset:record.targetOffset,referenceCount:0,
     firstMapOrdinal:ordinal,lastMapOrdinal:ordinal,references:[]};
    targets.set(record.targetOffset,group);
   }
   group.referenceCount++;
   group.lastMapOrdinal=ordinal;
   if(group.references.length<maxReferences)
    group.references.push(Object.freeze({
     bankIndex:map.bankIndex,mapIndex:map.mapIndex,kind:record.kind,
     index:record.index,pointerSourceOffset:record.sourceOffset
    }));
  }
 }
 const shared=[...targets.values()].filter(g=>g.referenceCount>1)
  .sort((a,b)=>a.targetOffset-b.targetOffset);
 const groups=shared.slice(0,maxGroups).map(g=>Object.freeze({
  targetOffset:g.targetOffset,referenceCount:g.referenceCount,
  firstMapOrdinal:g.firstMapOrdinal,lastMapOrdinal:g.lastMapOrdinal,
  crossesSixtyFourMapWindow:Math.floor(g.firstMapOrdinal/64)!==
   Math.floor(g.lastMapOrdinal/64),
  references:Object.freeze(g.references),
  referencesTruncated:g.referenceCount>g.references.length
 }));
 return Object.freeze({
  mapsInspected:atlas.maps.length,totalMaps:atlas.maps.length,
  pointerFields,inRomPointers,distinctTargets:targets.size,
  totalGroups:shared.length,groups:Object.freeze(groups),
  truncated:shared.length>groups.length,wholeDeclaredAtlas:true,
  readOnly:true,layoutAuthenticated:false,ownershipAuthenticated:false,
  controlFlowFollowed:false,writeAuthorized:false,
  independentParityEvidence:false
 });
}
