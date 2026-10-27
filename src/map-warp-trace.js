/**
 * Read-only vanilla warp destination trace for explicitly declared map banks.
 * Source: pinned CUBHMA MapModel.cs vanilla EventsFormat/WarpsFormat.
 * A raw destination is NOT an authenticated runtime teleport or CUBE layout.
 */
import {inspectVanillaMapEvents} from './map-events.js';
import {inspectVanillaMapHeader} from './map-layouts.js';
import {inspectBlockMap} from './map-blocks.js';
import {lookupVanillaMapAtlasTarget} from './map-atlas.js';

function headerFor(source,atlas,entry) {
 const header=inspectVanillaMapHeader(source,{address:entry.mapHeaderOffset,family:atlas.family});
 const layout=header.layout;
 if(layout.width!==entry.width||layout.height!==entry.height||
    layout.blockmapOffset!==entry.blockmapOffset||header.layoutOffset!==entry.layoutOffset)
  throw new RangeError('Declared atlas map layout changed; reinspect atlas');
 return header;
}
export function traceVanillaWarpArrival(source,atlas,{bankIndex,mapIndex,warpIndex}={}) {
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
    atlas.maps.length<1||atlas.maps.length>4096)
  throw new TypeError('Expected a read-only explicitly declared vanilla atlas');
 const entry=lookupVanillaMapAtlasTarget(atlas,bankIndex,mapIndex);
 if(!entry)throw new RangeError('Source map is outside declared atlas');
 const header=headerFor(source,atlas,entry);
 const events=inspectVanillaMapEvents(source,{address:entry.mapHeaderOffset,family:atlas.family});
 if(!Number.isSafeInteger(warpIndex)||warpIndex<0||warpIndex>=events.arrays.warps.length)
  throw new RangeError('Warp index is outside selected source map');
 const warp=events.arrays.warps[warpIndex];
 const base={source:Object.freeze({bankIndex,mapIndex,warpIndex,
  recordOffset:warp.offset,headerOffset:entry.mapHeaderOffset}),
  targetBank:warp.targetBank,targetMap:warp.targetMap,targetWarpId:warp.warpId,
  readOnly:true,layoutAuthenticated:false,runtimeBehaviorVerified:false};
 if(warp.targetBank===255||warp.targetMap===255||warp.warpId===255)
  return Object.freeze({...base,status:'special',destination:null});
 const target=lookupVanillaMapAtlasTarget(atlas,warp.targetBank,warp.targetMap);
 if(!target)return Object.freeze({...base,status:'undeclared',destination:null});
 const targetHeader=headerFor(source,atlas,target);
 const targetEvents=inspectVanillaMapEvents(source,{address:target.mapHeaderOffset,family:atlas.family});
 if(warp.warpId>=targetEvents.arrays.warps.length)
  return Object.freeze({...base,status:'invalid-index',destination:null,
   targetHeaderOffset:target.mapHeaderOffset,targetWarpCount:targetEvents.arrays.warps.length});
 const arrival=targetEvents.arrays.warps[warp.warpId];
 if(arrival.x>=targetHeader.layout.width||arrival.y>=targetHeader.layout.height)
  return Object.freeze({...base,status:'out-of-bounds',destination:null,
   targetHeaderOffset:target.mapHeaderOffset,targetWarpOffset:arrival.offset});
 const cell=inspectBlockMap(source,{address:targetHeader.layout.blockmapOffset,
  width:targetHeader.layout.width,height:targetHeader.layout.height,
  x:arrival.x,y:arrival.y,viewportWidth:1,viewportHeight:1}).cells[0][0];
 return Object.freeze({...base,status:'raw-arrival',
  destination:Object.freeze({bankIndex:warp.targetBank,mapIndex:warp.targetMap,
   warpIndex:warp.warpId,headerOffset:target.mapHeaderOffset,
   warpRecordOffset:arrival.offset,x:arrival.x,y:arrival.y,elevation:arrival.elevation,
   blockmapByteOffset:cell.byteOffset,tileId:cell.tileId,rawCollision:cell.collision,
   width:targetHeader.layout.width,height:targetHeader.layout.height})});
}


/**
 * Inspect whether the raw arrival warp record points back to its source.
 * A non-reciprocal warp is a REVIEW HINT, not an error: one-way and scripted
 * travel are valid. No runtime teleport semantics are inferred.
 * Rechecks pointer sources and layouts against current staged ROM bytes.
 */
export function auditVanillaWarpReturns(source,atlas,{
 bankIndex,mapIndex,maxResults=128
}={}){
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
    atlas.maps.length<1||atlas.maps.length>4096)
  throw new TypeError('Expected a declared read-only vanilla atlas');
 if(!Number.isSafeInteger(maxResults)||maxResults<1||maxResults>256)
  throw new RangeError('Return audit cap must be 1–256');
 const selected=lookupVanillaMapAtlasTarget(atlas,bankIndex,mapIndex);
 if(!selected)throw new RangeError('Source map outside declared atlas');
 const rom=source instanceof Uint8Array?{length:source.length,read:i=>source[i]}:source;
 if(!rom||!Number.isSafeInteger(rom.length)||typeof rom.read!=='function')
  throw new TypeError('Expected ROM bytes or staged reader');
 const read=i=>{
  if(!Number.isSafeInteger(i)||i<0||i>=rom.length)throw new RangeError('Pointer outside ROM');
  const b=rom.read(i);
  if(!Number.isInteger(b)||b<0||b>255)throw new RangeError('Invalid ROM byte');
  return b;
 };
 const pointer=i=>(read(i)|(read(i+1)<<8)|(read(i+2)<<16)|(read(i+3)<<24))>>>0;
 const checked=new Set();
 function verify(entry){
  if(!Number.isSafeInteger(entry.mapPointerSource)||entry.mapPointerSource<0||
     !Number.isSafeInteger(entry.mapHeaderOffset)||entry.mapHeaderOffset<0||
     pointer(entry.mapPointerSource)!==(0x08000000+entry.mapHeaderOffset))
   throw new RangeError('Atlas pointer changed; reinspect');
  if(checked.has(entry.mapHeaderOffset))return;
  const h=inspectVanillaMapHeader(rom,{address:entry.mapHeaderOffset,family:atlas.family});
  if(h.layoutOffset!==entry.layoutOffset||h.layout.blockmapOffset!==entry.blockmapOffset||
     h.layout.width!==entry.width||h.layout.height!==entry.height)
   throw new RangeError('Atlas layout changed; reinspect');
  checked.add(entry.mapHeaderOffset);
 }
 verify(selected);
 const events=inspectVanillaMapEvents(rom,{address:selected.mapHeaderOffset,family:atlas.family});
 const counts={reciprocal:0,differentWarp:0,differentMap:0,specialReturn:0,unresolved:0};
 const records=[];
 for(const warp of events.arrays.warps){
  const trace=traceVanillaWarpArrival(rom,atlas,{
   bankIndex,mapIndex,warpIndex:warp.index
  });
  let status,arrival=null,returnTarget=null;
  if(trace.status!=='raw-arrival'){
   status='unresolved';
  }else{
   const destination=trace.destination;
   const entry=lookupVanillaMapAtlasTarget(atlas,destination.bankIndex,destination.mapIndex);
   verify(entry);
   const targetEvents=inspectVanillaMapEvents(rom,{
    address:entry.mapHeaderOffset,family:atlas.family
   });
   const back=targetEvents.arrays.warps[destination.warpIndex];
   returnTarget=Object.freeze({bankIndex:back.targetBank,mapIndex:back.targetMap,
    warpIndex:back.warpId,recordOffset:back.offset});
   arrival=Object.freeze({bankIndex:destination.bankIndex,mapIndex:destination.mapIndex,
    warpIndex:destination.warpIndex,x:destination.x,y:destination.y});
   if(back.targetBank===255||back.targetMap===255||back.warpId===255)
    status='specialReturn';
   else if(back.targetBank!==bankIndex||back.targetMap!==mapIndex)
    status='differentMap';
   else if(back.warpId!==warp.index)status='differentWarp';
   else status='reciprocal';
  }
  counts[status]++;
  if(records.length<maxResults)records.push(Object.freeze({
   sourceWarpIndex:warp.index,sourceRecordOffset:warp.offset,
   targetBank:warp.targetBank,targetMap:warp.targetMap,targetWarpId:warp.warpId,
   traceStatus:trace.status,status,arrival,returnTarget
  }));
 }
 return Object.freeze({bankIndex,mapIndex,headerOffset:selected.mapHeaderOffset,
  totalWarps:events.arrays.warps.length,counts:Object.freeze(counts),
  truncated:events.arrays.warps.length>records.length,records:Object.freeze(records),
  readOnly:true,layoutAuthenticated:false,runtimeBehaviorVerified:false,
  reciprocalRequired:false});
}
