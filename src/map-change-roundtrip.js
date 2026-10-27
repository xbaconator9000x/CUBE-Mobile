/**
 * Read-only typed decode -> reviewed overlay -> decode roundtrip for proposed
 * VANILLA map records. This is a preflight only: it does not write a ROM,
 * authenticate CUBE layout, interpret movement rules or prove runtime safety.
 * Source: pinned CUBHMA MapModel.cs BlockCells and EventsFormat records.
 */
import {auditVanillaChangeImpact} from './map-change-impact.js';
import {createVanillaReviewedChangeOverlay} from './map-change-review.js';
import {inspectBlockMap} from './map-blocks.js';
import {inspectVanillaMapEvents} from './map-events.js';
import {traceVanillaWarpArrival} from './map-warp-trace.js';

function typedRecord(source,atlas,owner,entry){
 const map=atlas.maps.find(m=>m.bankIndex===owner.bankIndex&&
   m.mapIndex===owner.mapIndex&&m.mapHeaderOffset===owner.headerOffset);
 if(!map)throw new RangeError('Reviewed owner is absent from the declared atlas');
 if(entry.kind==='blockmap'){
  const relative=entry.offset-map.blockmapOffset;
  if(relative<0||relative%2||relative>=map.width*map.height*2)
   throw new RangeError('Reviewed blockmap cell is outside its owner');
  const cell=relative/2;
  const view=inspectBlockMap(source,{address:map.blockmapOffset,
   width:map.width,height:map.height,x:cell%map.width,
   y:Math.floor(cell/map.width),viewportWidth:1,viewportHeight:1});
  const c=view.cells[0][0];
  return Object.freeze({tileId:c.tileId,rawCollision:c.collision,
   x:c.x,y:c.y,byteOffset:c.byteOffset});
 }
 const events=inspectVanillaMapEvents(source,{
  address:map.mapHeaderOffset,family:atlas.family});
 const kind=entry.kind==='warp'?'warps':entry.kind;
 const size={warps:8,objects:24,scripts:16,signposts:12}[kind];
 const offset=events.offsets[kind];
 if(offset===null||entry.offset<offset||
    (entry.offset-offset)%size!==0)
  throw new RangeError('Reviewed event has no aligned array owner');
 const index=(entry.offset-offset)/size;
 const record=events.arrays[kind][index];
 if(!record||record.offset!==entry.offset)
  throw new RangeError('Reviewed event record no longer exists');
 return record;
}
function value(record,field){
 const result=record[field];
 if(!Number.isSafeInteger(result)||result<0)
  throw new RangeError('Decoded field is not a valid unsigned integer');
 return result;
}
/**
 * All changed fields must decode to the exact expected before/after values
 * for EVERY declared owner. Shared records are checked once per map alias.
 * Cross-structure overlaps and truncated owner lists fail closed.
 */
export function auditVanillaQueuedChangeRoundtrip(source,atlas,previews,{
 maxChanges=64,maxBytes=2048,maxOwners=32
}={}){
 const impact=auditVanillaChangeImpact(source,atlas,previews,{
  maxChanges,maxBytes,maxOwners,maxConflicts:16});
 const overlay=createVanillaReviewedChangeOverlay(source,previews,{
  maxChanges,maxBytes});
 const results=[];
 let checkedOwners=0,changedFields=0;
 for(const [i,entry] of overlay.review.entries.entries()){
  const structural=impact.entries[i];
  if(structural.sourceIndex!==entry.sourceIndex||
     structural.offset!==entry.offset||structural.kind!==entry.kind)
   throw new RangeError('Impact review and byte overlay disagree');
  if(structural.structuralConflict)
   throw new RangeError('Reviewed record intersects another map structure');
  if(structural.ownersTruncated||structural.ownerCount!==structural.owners.length)
   throw new RangeError('Reviewed owner list is incomplete');
  const owners=[];
  for(const owner of structural.owners){
   const original=typedRecord(source,atlas,owner,entry);
   const proposed=typedRecord(overlay.source,atlas,owner,entry);
   for(const field of entry.fieldChanges){
    if(value(original,field.field)!==field.before||
       value(proposed,field.field)!==field.after)
     throw new RangeError('Typed map record did not roundtrip as reviewed');
   }
   if(entry.kind==='blockmap'&&original.byteOffset!==entry.offset||
      entry.kind==='blockmap'&&proposed.byteOffset!==entry.offset)
    throw new RangeError('Blockmap cell offset changed after overlay');
   const inBounds=entry.kind==='blockmap'?true:
    proposed.x<atlas.maps.find(m=>m.bankIndex===owner.bankIndex&&
     m.mapIndex===owner.mapIndex).width&&
    proposed.y<atlas.maps.find(m=>m.bankIndex===owner.bankIndex&&
     m.mapIndex===owner.mapIndex).height;
   let arrivalStatus=null;
   if(entry.kind==='warp'){
    const index=impact.entries[i].sourceIndex;
    const p=previews[index];
    const trace=traceVanillaWarpArrival(overlay.source,atlas,{
     bankIndex:owner.bankIndex,mapIndex:owner.mapIndex,warpIndex:p.warpIndex});
    arrivalStatus=trace.status;
   }
   owners.push(Object.freeze({bankIndex:owner.bankIndex,mapIndex:owner.mapIndex,
    headerOffset:owner.headerOffset,coordinatesInMap:inBounds,
    warpArrivalStatus:arrivalStatus}));
   checkedOwners++;
  }
  changedFields+=entry.fieldChanges.length;
  results.push(Object.freeze({sourceIndex:entry.sourceIndex,kind:entry.kind,
   offset:entry.offset,changed:entry.changed,fields:entry.fieldChanges,
   ownerCount:owners.length,owners:Object.freeze(owners)}));
 }
 return Object.freeze({records:results.length,checkedOwners,changedFields,
  entries:Object.freeze(results),typedRoundtripPassed:true,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  layoutAuthenticated:false,ownershipAuthenticated:false,
  transactionCommitted:false,runtimeBehaviorVerified:false});
}
