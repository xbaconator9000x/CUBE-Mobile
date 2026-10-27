/**
 * Read-only ownership/overlap review of vanilla map event groups and arrays.
 * Grounded in pinned kcradi/CUBHMA MapModel.cs Format.EventsFormat,
 * ObjectsFormat, WarpsFormat, ScriptsFormat and SignpostsFormat.
 * A declared vanilla atlas is not CUBE layout authentication.
 */
import {inspectVanillaMapAtlas} from './map-atlas.js';
import {inspectVanillaMapEvents} from './map-events.js';

const definitions=Object.freeze([
 Object.freeze({kind:'objects',size:24,pointerField:4}),
 Object.freeze({kind:'warps',size:8,pointerField:8}),
 Object.freeze({kind:'scripts',size:16,pointerField:12}),
 Object.freeze({kind:'signposts',size:12,pointerField:16})
]);
function cap(n,max,label){
 if(!Number.isSafeInteger(n)||n<1||n>max)
  throw new RangeError(label+' must be between 1 and '+max);
}
function frozenReference(map,sourceOffset){
 return Object.freeze({bankIndex:map.bankIndex,mapIndex:map.mapIndex,
  headerOffset:map.mapHeaderOffset,sourceOffset});
}
function checkAtlas(source,atlas){
 if(!atlas||atlas.readOnly!==true||atlas.layoutAuthenticated!==false||
    !['RSE','FRLG'].includes(atlas.family)||!Array.isArray(atlas.maps)||
    !Array.isArray(atlas.bankMapCounts)||atlas.maps.length<1||
    atlas.maps.length>4096)
  throw new TypeError('An explicitly declared read-only vanilla atlas is required');
 // Re-resolve the bank table and every header from current staged ROM bytes.
 // A previously captured map header/layout alone is insufficient: the bank
 // pointer could have changed while still pointing to valid map data.
 const fresh=inspectVanillaMapAtlas(source,{address:atlas.address,
  bankMapCounts:atlas.bankMapCounts,family:atlas.family,maxMaps:4096});
 if(fresh.maps.length!==atlas.maps.length)throw new RangeError('Stale atlas map count');
 for(let i=0;i<fresh.maps.length;i++){
  const a=atlas.maps[i],b=fresh.maps[i];
  for(const field of ['bankIndex','mapIndex','mapPointerSource','mapHeaderOffset',
   'layoutOffset','blockmapOffset','width','height']){
   if(a[field]!==b[field])throw new RangeError('Atlas changed since inspection; reselect the map catalog');
  }
 }
 return fresh;
}
/**
 * Inspect all declared maps (up to 4096) and return bounded alias groups and
 * overlap findings. Counts include all groups/spans, not just displayed ones.
 * An overlap finding counts each distinct span that intersects an earlier
 * distinct span, not every possible pair. No edit permissions are implied.
 */
export function auditVanillaAtlasEventOwnership(source,atlas,{
 maxGroups=64,maxReferences=8,maxConflicts=64
}={}){
 cap(maxGroups,256,'Alias group limit');
 cap(maxReferences,32,'Reference limit');
 cap(maxConflicts,256,'Overlap finding limit');
 const current=checkAtlas(source,atlas);
 const byKey=new Map();
 let totalReferences=0,mapsWithEvents=0;
 for(const map of current.maps){
  const events=inspectVanillaMapEvents(source,{
   address:map.mapHeaderOffset,family:current.family});
  if(events.eventsOffset===null)continue;
  mapsWithEvents++;
  const claims=[{kind:'events',offset:events.eventsOffset,size:20,
   sourceOffset:map.mapHeaderOffset+4}];
  for(const def of definitions){
   const count=events.counts[def.kind];
   if(count>0)claims.push({kind:def.kind,offset:events.offsets[def.kind],
    size:count*def.size,sourceOffset:events.eventsOffset+def.pointerField});
  }
  for(const claim of claims){
   const key=claim.kind+':'+claim.offset+':'+claim.size;
   let span=byKey.get(key);
   if(!span){
    span={kind:claim.kind,offset:claim.offset,size:claim.size,references:[]};
    byKey.set(key,span);
   }
   span.references.push(frozenReference(map,claim.sourceOffset));
   totalReferences++;
  }
 }
 const counts={events:0,objects:0,warps:0,scripts:0,signposts:0};
 const groups=[];let totalGroups=0;
 for(const span of byKey.values()){
  if(span.references.length<2)continue;
  totalGroups++;counts[span.kind]++;
  if(groups.length<maxGroups)groups.push(Object.freeze({
   kind:span.kind,offset:span.offset,size:span.size,
   referenceCount:span.references.length,
   references:Object.freeze(span.references.slice(0,maxReferences)),
   referencesTruncated:span.references.length>maxReferences
  }));
 }
 // Collapse identical typed spans before the sweep. Detect partial overlaps
 // and cross-kind overlaps in O(n log n), without quadratic pair enumeration.
 const spans=[...byKey.values()].sort((a,b)=>a.offset-b.offset||
  (b.offset+b.size)-(a.offset+a.size)||a.kind.localeCompare(b.kind));
 let maxEnd=-1,previous=null,overlapCount=0;
 const overlaps=[];
 for(const span of spans){
  if(span.offset<maxEnd){
   overlapCount++;
   if(overlaps.length<maxConflicts)overlaps.push(Object.freeze({
    kind:span.kind,offset:span.offset,size:span.size,
    intersectsKind:previous.kind,intersectsOffset:previous.offset,
    intersectsSize:previous.size,
    reference:Object.freeze(span.references[0]),
    intersectsReference:Object.freeze(previous.references[0])
   }));
  }
  if(span.offset+span.size>maxEnd){
   maxEnd=span.offset+span.size;previous=span;
  }
 }
 return Object.freeze({
  totalMaps:current.maps.length,mapsWithEvents,totalReferences,
  distinctSpans:spans.length,counts:Object.freeze(counts),totalGroups,
  groups:Object.freeze(groups),groupsTruncated:totalGroups>groups.length,
  overlapCount,overlaps:Object.freeze(overlaps),
  overlapsTruncated:overlapCount>overlaps.length,
  readOnly:true,layoutAuthenticated:false,ownershipAuthenticated:false,
  writeAuthorized:false
 });
}
