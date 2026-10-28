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

/**
 * Inspect a complete bounded source-map warp set, not just a single link.
 * Destination bank counts are caller-declared, never inferred from pointer
 * contents. Findings are raw structural diagnostics, NOT gameplay proof.
 *
 * A return to the origin map is weaker than a return to the same source
 * warp index. Keep both checks separate so a wrong-door return is visible.
 */
export function auditHmaCubeWarpTopology(source,summary,{
 bankIndex,mapIndex,mapCount,targetBanks,maxWarps=32
}={}){
 if(!Array.isArray(targetBanks)||targetBanks.length<1||targetBanks.length>8)
  throw new RangeError('Supply 1–8 explicitly counted destination banks');
 if(!Number.isSafeInteger(maxWarps)||maxWarps<1||maxWarps>64)
  throw new RangeError('Warp audit budget must be 1–64');
 const counts=new Map();
 for(const entry of targetBanks){
  if(!entry||!Number.isSafeInteger(entry.bankIndex)||entry.bankIndex<0||
     !Number.isSafeInteger(entry.mapCount)||entry.mapCount<1||entry.mapCount>1024||
     counts.has(entry.bankIndex))
   throw new RangeError('Duplicate or invalid destination-bank declaration');
  counts.set(entry.bankIndex,entry.mapCount);
 }
 const origin=inspectHmaCubeMapEventWarps(source,summary,{bankIndex,mapIndex,mapCount});
 if(origin.warps.length>maxWarps)
  throw new RangeError('Source warp count exceeds bounded audit budget');
 const coordinates=new Map();
 for(const warp of origin.warps){
  const key=warp.x+':'+warp.y;
  coordinates.set(key,(coordinates.get(key)||0)+1);
 }
 const records=origin.warps.map(warp=>{
  const issues=[];
  if(warp.outsideDeclaredMap)issues.push('source-outside-map');
  if(coordinates.get(warp.x+':'+warp.y)>1)issues.push('shared-source-coordinate');
  let status='unresolved',arrival=null,returnToSourceWarp=false;
  if(warp.specialTarget||warp.warpId===255){
   status='special-or-unresolved';
  }else if(warp.targetBank>=origin.map.declaredBankCount){
   status='outside-declared-bank-table';
   issues.push('invalid-target-bank');
  }else if(!counts.has(warp.targetBank)){
   status='target-bank-count-not-declared';
  }else{
   const trace=traceHmaCubeWarpArrival(source,summary,{
    bankIndex,mapIndex,mapCount,warpIndex:warp.index,
    targetMapCount:counts.get(warp.targetBank)
   });
   status=trace.status;
   if(status==='resolved-raw'){
    arrival=trace.arrival;
    returnToSourceWarp=arrival.returnsToOrigin&&arrival.returnWarpId===warp.index;
    if(!arrival.coordinatesInBounds)issues.push('arrival-outside-map');
    if(!arrival.returnsToOrigin)issues.push('no-direct-return-to-origin-map');
    else if(!returnToSourceWarp)issues.push('return-points-to-different-source-warp');
   }else if(status!=='special-or-unresolved'){
    issues.push('unresolved-destination');
   }
  }
  return Object.freeze({
   index:warp.index,offset:warp.offset,x:warp.x,y:warp.y,
   elevation:warp.elevation,targetBank:warp.targetBank,targetMap:warp.targetMap,
   targetWarpIndex:warp.warpId,status,arrival,
   rawReturnToSameWarp:returnToSourceWarp,
   issues:Object.freeze(issues)
  });
 });
 return Object.freeze({
  bankIndex,mapIndex,mapCount,sourceWidth:origin.map.layout.width,
  sourceHeight:origin.map.layout.height,inspectedWarps:records.length,
  findings:records.reduce((n,r)=>n+r.issues.length,0),
  records:Object.freeze(records),readOnly:true,romAuthenticated:false,
  cubeLayoutAuthenticated:false,travelVerified:false,writeAuthorized:false,
  countsExplicit:true
 });
}
