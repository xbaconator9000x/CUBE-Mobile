/**
 * Read-only structural cross-reference audit for a user-declared vanilla map atlas.
 * No ROM fingerprint, game semantics, CUBE layout, or destination behavior is
 * authenticated by this module. It never modifies ROM bytes.
 */
import {inspectVanillaMapEvents} from './map-events.js';
import {inspectVanillaMapConnections} from './map-connections.js';
import {lookupVanillaMapAtlasTarget} from './map-atlas.js';

export function auditVanillaMapLinks(source,atlas,{bankIndex,mapIndex}={}) {
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !Array.isArray(atlas.maps)||!['RSE','FRLG'].includes(atlas.family))
  throw new TypeError('A read-only, explicitly declared vanilla atlas is required');
 const selected=lookupVanillaMapAtlasTarget(atlas,bankIndex,mapIndex);
 if(!selected)throw new RangeError('Map is outside the declared atlas');
 const events=inspectVanillaMapEvents(source,{address:selected.mapHeaderOffset,family:atlas.family});
 const connections=inspectVanillaMapConnections(source,{address:selected.mapHeaderOffset,family:atlas.family});
 const cache=new Map();
 function inspectTarget(bank,map) {
  const target=lookupVanillaMapAtlasTarget(atlas,bank,map);
  if(!target)return null;
  const key=bank+','+map;
  if(!cache.has(key))cache.set(key,inspectVanillaMapEvents(source,{
   address:target.mapHeaderOffset,family:atlas.family
  }).arrays.warps.length);
  return {target,warpCount:cache.get(key)};
 }
 const records=[];
 for(const warp of events.arrays.warps) {
  const special=warp.targetBank===255||warp.targetMap===255;
  const info=special?null:inspectTarget(warp.targetBank,warp.targetMap);
  let status='declared',detail='Destination is present in the declared atlas; no runtime behavior verified';
  if(special){status='special';detail='0xFF target field; runtime destination unresolved';}
  else if(!info){status='undeclared';detail='Destination absent from the supplied map counts (not proof of invalidity)';}
  else if(warp.warpId===255){status='special';detail='0xFF destination warp index; runtime behavior unresolved';}
  else if(warp.warpId>=info.warpCount){
   status='needs-review';detail='Raw destination warp index exceeds the declared target warp records';
  }
  records.push(Object.freeze({kind:'warp',index:warp.index,offset:warp.offset,
   targetBank:warp.targetBank,targetMap:warp.targetMap,targetWarpId:warp.warpId,
   targetHeaderOffset:info?.target.mapHeaderOffset??null,status,detail}));
 }
 for(const connection of connections.connections) {
  const special=connection.targetBank===255||connection.targetMap===255;
  const target=special?null:lookupVanillaMapAtlasTarget(atlas,connection.targetBank,connection.targetMap);
  const status=special?'special':target?'declared':'undeclared';
  const detail=special?'0xFF target field; runtime destination unresolved':
   target?'Destination is present in the declared atlas; topology not verified':
   'Destination absent from supplied map counts (not proof of invalidity)';
  records.push(Object.freeze({kind:'connection',index:connection.index,offset:connection.offset,
   targetBank:connection.targetBank,targetMap:connection.targetMap,targetWarpId:null,
   targetHeaderOffset:target?.mapHeaderOffset??null,status,detail}));
 }
 const counts=Object.freeze({declared:records.filter(x=>x.status==='declared').length,
  undeclared:records.filter(x=>x.status==='undeclared').length,
  special:records.filter(x=>x.status==='special').length,
  needsReview:records.filter(x=>x.status==='needs-review').length});
 return Object.freeze({bankIndex,mapIndex,headerOffset:selected.mapHeaderOffset,
  counts,records:Object.freeze(records),readOnly:true,layoutAuthenticated:false});
}

/**
 * Inspect a bounded page of the explicitly declared vanilla atlas. Only
 * non-declared link statuses are retained; counters cover every link.
 * A caller must revalidate ROM/atlas identity before each page.
 */
export function auditVanillaAtlasLinkBatch(source,atlas,{start=0,limit=16,maxFindings=128}={}) {
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !Array.isArray(atlas.maps)||!['RSE','FRLG'].includes(atlas.family))
  throw new TypeError('A read-only declared vanilla atlas is required');
 if(!Number.isSafeInteger(start)||start<0||start>=atlas.maps.length)
  throw new RangeError('Batch start must select a declared map');
 if(!Number.isSafeInteger(limit)||limit<1||limit>32)
  throw new RangeError('Batch size must be 1–32 maps');
 if(!Number.isSafeInteger(maxFindings)||maxFindings<1||maxFindings>256)
  throw new RangeError('Finding limit must be 1–256');
 const end=Math.min(atlas.maps.length,start+limit);
 const counts={declared:0,undeclared:0,special:0,needsReview:0};
 const findings=[];let totalFindings=0;
 for(let i=start;i<end;i++){
  const map=atlas.maps[i];
  const result=auditVanillaMapLinks(source,atlas,{
   bankIndex:map.bankIndex,mapIndex:map.mapIndex
  });
  for(const key of Object.keys(counts))counts[key]+=result.counts[key];
  for(const record of result.records){
   if(record.status==='declared')continue;
   totalFindings++;
   if(findings.length<maxFindings)findings.push(Object.freeze({
    bankIndex:map.bankIndex,mapIndex:map.mapIndex,
    headerOffset:map.mapHeaderOffset,...record
   }));
  }
 }
 return Object.freeze({
  start,end,scannedMaps:end-start,totalMaps:atlas.maps.length,
  nextStart:end<atlas.maps.length?end:null,
  counts:Object.freeze(counts),totalFindings,
  truncated:totalFindings>findings.length,
  findings:Object.freeze(findings),readOnly:true,layoutAuthenticated:false
 });
}
