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
