/**
 * Read-only structural impact audit for queued vanilla map previews.
 * Grounded in pinned CUBHMA MapModel.cs: AllMapsModel, BlockCells,
 * EventsFormat, ObjectsFormat, WarpsFormat, ScriptsFormat, SignpostsFormat.
 * Re-resolves the declared atlas from CURRENT staged bytes, then reports
 * shared owners and cross-structure intersections. No semantic write authority.
 */
import {inspectVanillaMapAtlas} from './map-atlas.js';
import {inspectVanillaMapEvents} from './map-events.js';
import {reviewVanillaChangeSet} from './map-change-review.js';

const EVENT_SIZES=Object.freeze({objects:24,warps:8,scripts:16,signposts:12});
function intersects(a,al,b,bl){return a<b+bl&&b<a+al;}
function mapRef(m){return Object.freeze({bankIndex:m.bankIndex,mapIndex:m.mapIndex,headerOffset:m.mapHeaderOffset});}
function claim(kind,offset,length,map,unit=0){
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1)
  throw new RangeError('Invalid map structure span');
 return {kind,offset,length,map,unit};
}
function checkedAtlas(source,atlas){
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
    atlas.maps.length<1||atlas.maps.length>4096||!Array.isArray(atlas.bankMapCounts))
  throw new TypeError('Explicitly declared read-only vanilla atlas required');
 const fresh=inspectVanillaMapAtlas(source,{address:atlas.address,
  family:atlas.family,bankMapCounts:atlas.bankMapCounts,maxMaps:4096});
 if(fresh.maps.length!==atlas.maps.length||fresh.banks.length!==atlas.banks?.length)
  throw new RangeError('Atlas changed; inspect again');
 for(let i=0;i<fresh.maps.length;i++){
  for(const field of ['bankIndex','mapIndex','mapHeaderOffset','mapPointerSource',
   'layoutOffset','blockmapOffset','width','height'])
   if(fresh.maps[i][field]!==atlas.maps[i][field])
    throw new RangeError('Atlas changed; inspect again');
 }
 return fresh;
}
/**
 * Check all proposed records against the complete declared vanilla map
 * catalog. Reports shared structural owners and intersections with any other
 * known map structure. A clean report is NOT proof of free-space ownership,
 * script safety, CUBE layout compatibility, or runtime validity.
 */
export function auditVanillaChangeImpact(source,atlas,previews,{
 maxChanges=64,maxBytes=2048,maxOwners=12,maxConflicts=16
}={}){
 if(!Number.isSafeInteger(maxOwners)||maxOwners<1||maxOwners>32||
    !Number.isSafeInteger(maxConflicts)||maxConflicts<1||maxConflicts>64)
  throw new RangeError('Impact output caps outside supported bounds');
 const review=reviewVanillaChangeSet(source,previews,{maxChanges,maxBytes});
 const fresh=checkedAtlas(source,atlas);
 const claims=[];
 for(const bank of fresh.banks)
  claims.push(claim('map-pointer-array',bank.bankOffset,bank.mapCount*4,null));
 claims.push(claim('bank-pointer-table',fresh.address,fresh.bankCount*4,null));
 const seenHeaders=new Set();
 for(const map of fresh.maps){
  const ref=mapRef(map);
  claims.push(claim('blockmap',map.blockmapOffset,map.width*map.height*2,ref,2));
  if(!seenHeaders.has(map.mapHeaderOffset)){
   seenHeaders.add(map.mapHeaderOffset);
   claims.push(claim('map-header',map.mapHeaderOffset,28,null));
   claims.push(claim('map-layout',map.layoutOffset,fresh.family==='FRLG'?28:24,null));
  }
 }
 // Events are parsed once per unique header, not once per alias. Reusing the
 // resulting spans for every map preserves alias ownership without re-reading.
 const eventsByHeader=new Map();
 {
  for(const map of fresh.maps){
   let events=eventsByHeader.get(map.mapHeaderOffset);
   if(!events){
    events=inspectVanillaMapEvents(source,{address:map.mapHeaderOffset,family:fresh.family});
    eventsByHeader.set(map.mapHeaderOffset,events);
   }
   if(events.eventsOffset===null)continue;
   const ref=mapRef(map);
   claims.push(claim('events-group',events.eventsOffset,20,null));
   for(const [kind,size] of Object.entries(EVENT_SIZES))
    if(events.counts[kind]>0)
     claims.push(claim(kind==='warps'?'warp':kind,events.offsets[kind],events.counts[kind]*size,ref,size));
  }
 }
 const results=[];
 let sharedRecords=0,conflictedRecords=0;
 for(const entry of review.entries){
  const preview=previews[entry.sourceIndex];
  const owners=[],conflicts=[];
  let ownerCount=0,conflictCount=0,sourceProvenance=false;
  for(const c of claims){
   if(!intersects(entry.offset,entry.length,c.offset,c.length))continue;
   const exact=c.kind===entry.kind&&c.unit===entry.length&&
     entry.offset>=c.offset&&(entry.offset-c.offset)%c.unit===0&&
     entry.offset+entry.length<=c.offset+c.length;
   if(exact){
    ownerCount++;
    if(owners.length<maxOwners)owners.push(c.map);
    if(c.map.headerOffset===preview.headerOffset){
     if(entry.kind==='blockmap'){
      if(preview.blockmapOffset===c.offset&&preview.byteOffset===entry.offset)
       sourceProvenance=true;
     }else{
      const ev=eventsByHeader.get(c.map.headerOffset);
      const index=(entry.offset-c.offset)/c.unit;
      if(preview.eventsOffset===ev.eventsOffset&&
         (entry.kind==='warp'?preview.warpIndex===index:
          preview.index===index&&preview.arrayOffset===c.offset))
       sourceProvenance=true;
     }
    }
   }else{
    conflictCount++;
    if(conflicts.length<maxConflicts)conflicts.push(Object.freeze({
     kind:c.kind,offset:c.offset,length:c.length,
     map:c.map
    }));
   }
  }
  if(!ownerCount||!sourceProvenance)
   throw new RangeError('Proposed record has no matching current atlas provenance');
  if(ownerCount>1)sharedRecords++;
  if(conflictCount)conflictedRecords++;
  results.push(Object.freeze({
   sourceIndex:entry.sourceIndex,kind:entry.kind,offset:entry.offset,
   changed:entry.changed,ownerCount,
   owners:Object.freeze(owners),ownersTruncated:ownerCount>owners.length,
   conflictCount,conflicts:Object.freeze(conflicts),
   conflictsTruncated:conflictCount>conflicts.length,
   shared:ownerCount>1,structuralConflict:conflictCount>0
  }));
 }
 return Object.freeze({
  totalMaps:fresh.mapCount,reviewed:results.length,sharedRecords,
  conflictedRecords,entries:Object.freeze(results),
  readOnly:true,layoutAuthenticated:false,ownershipAuthenticated:false,
  writeAuthorized:false,transactionCommitted:false
 });
}
