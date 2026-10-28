/**
 * Read-only CUBE custom warp destination trace with explicit target-bank
 * map count. Pinned CUBHMA MapModel.cs WarpsFormat. This is raw record
 * resolution, NOT an assertion of gameplay travel or safe editing.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
function index(value,max,label){
 if(!Number.isSafeInteger(value)||value<0||value>=max)
  throw new RangeError(label+' is outside explicit bounds');
}
export function traceHmaCubeWarpArrival(source,summary,{
 bankIndex,mapIndex,mapCount,warpIndex,targetMapCount
}={}){
 const sourceOptions={bankIndex,mapIndex,mapCount};
 const origin=inspectHmaCubeMapEventWarps(source,summary,sourceOptions);
 index(warpIndex,origin.warps.length,'Source warp index');
 const warp=origin.warps[warpIndex];
 const base={sourceBank:bankIndex,sourceMap:mapIndex,sourceWarpIndex:warpIndex,
  sourceOffset:warp.offset,targetBank:warp.targetBank,targetMap:warp.targetMap,
  targetWarpIndex:warp.warpId,readOnly:true,romAuthenticated:false,
  cubeLayoutAuthenticated:false,travelVerified:false,writeAuthorized:false};
 const outcome=(status,extra={})=>Object.freeze({...base,status,...extra});
 if(warp.specialTarget||warp.warpId===255)
  return outcome('special-or-unresolved');
 if(warp.targetBank>=origin.map.declaredBankCount)
  return outcome('outside-declared-bank-table');
 if(!Number.isSafeInteger(targetMapCount)||targetMapCount<1||targetMapCount>1024)
  throw new RangeError('Explicit target-bank map count must be 1–1024');
 if(warp.targetMap>=targetMapCount)return outcome('outside-explicit-target-map-count');
 const targetOptions={bankIndex:warp.targetBank,mapIndex:warp.targetMap,mapCount:targetMapCount};
 let target;
 try{target=inspectHmaCubeMapEventWarps(source,summary,targetOptions);}
 catch(_error){return outcome('invalid-or-unsupported-target');}
 if(warp.warpId>=target.warps.length)
  return outcome('target-warp-index-missing',{targetWarpCount:target.warps.length});
 const arrival=target.warps[warp.warpId];
 const coordinatesInBounds=!arrival.outsideDeclaredMap;
 const returnsToOrigin=arrival.targetBank===bankIndex&&arrival.targetMap===mapIndex;
 return outcome('resolved-raw',{targetMapCount,targetWarpCount:target.warps.length,
  arrival:Object.freeze({x:arrival.x,y:arrival.y,elevation:arrival.elevation,
   offset:arrival.offset,warpIndex:arrival.index,coordinatesInBounds,
   returnsToOrigin,returnWarpId:arrival.warpId}),
  targetWidth:target.map.layout.width,targetHeight:target.map.layout.height});
}
