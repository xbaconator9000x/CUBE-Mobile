/**
 * Atomic multi-kind CUBE Emerald event-position preview and copy-only rollback.
 * Source-grounded in pinned CUBHMA MapModel.cs fixed-width event arrays.
 * Never exports a ROM, interprets scripts, or authorizes semantic writes.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {previewHmaCubeEventPositionChange} from './hma-cube-event-position.js';

function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected bounded staged ROM reader');
}
function byte(rom,i){
 if(!Number.isSafeInteger(i)||i<0||i>=rom.length)
  throw new RangeError('Event byte outside ROM');
 const n=rom.read(i);
 if(!Number.isInteger(n)||n<0||n>255)
  throw new RangeError('Invalid staged ROM byte');
 return n;
}
function positionEqual(a,b){
 return a.x===b.x&&a.y===b.y&&a.elevation===b.elevation;
}
function key(kind,index){return kind+':'+index;}
/**
 * Validate all proposals against the SAME original snapshot, overlay all
 * changed position fields and re-decode every event kind. This supports
 * coordinated relocations without falsely rejecting temporary overlaps.
 */
export function previewHmaCubeEventPositionBatch(source,summary,{
 bankIndex,mapIndex,mapCount,changes
}={}){
 const rom=reader(source),opts={bankIndex,mapIndex,mapCount};
 if(!Array.isArray(changes)||changes.length<1||changes.length>32)
  throw new RangeError('Provide 1–32 event position proposals');
 const original=inspectHmaCubeMapEventWarps(rom,summary,opts);
 const seen=new Set(),overlay=new Map(),expectedBytes=new Map(),records=[];
 for(const change of changes){
  if(!change||seen.has(key(change.kind,change.index)))
   throw new RangeError('Duplicate or invalid event proposal');
  seen.add(key(change.kind,change.index));
  const plan=previewHmaCubeEventPositionChange(rom,summary,{
   ...opts,...change
  });
  for(const patch of plan.rawBytes){
   if(overlay.has(patch.offset))
    throw new RangeError('Overlapping event position fields');
   overlay.set(patch.offset,patch.value);
   expectedBytes.set(patch.offset,patch.expected);
  }
  records.push(Object.freeze({
   kind:plan.kind,index:plan.index,sourceOffset:plan.sourceOffset,
   before:plan.before,after:plan.after,changedFields:plan.changedFields
  }));
 }
 for(const [offset,expected] of expectedBytes)
  if(byte(rom,offset)!==expected)
   throw new RangeError('Source event bytes changed before combined preview');
 const staged=Object.freeze({length:rom.length,
  read:i=>overlay.has(i)?overlay.get(i):byte(rom,i)});
 const after=inspectHmaCubeMapEventWarps(staged,summary,opts);
 const edits=new Map(records.map(r=>[key(r.kind,r.index),r]));
 for(const kind of Object.keys(original.arrays)){
  if(original.arrays[kind].length!==after.arrays[kind].length)
   throw new RangeError('Combined edit changed event array count');
  for(let i=0;i<original.arrays[kind].length;i++){
   const beforeRecord=original.arrays[kind][i];
   const afterRecord=after.arrays[kind][i];
   const edit=edits.get(key(kind,i));
   if(edit){
    if(afterRecord.offset!==beforeRecord.offset||
       !positionEqual(afterRecord,edit.after))
     throw new RangeError('Combined event position re-decode failed');
   }else if(JSON.stringify(beforeRecord)!==JSON.stringify(afterRecord))
    throw new RangeError('Combined edit modified an unrelated event');
  }
 }
 const collisions=[];
 const coordinates=new Map();
 for(const [kind,items] of Object.entries(after.arrays))
  for(const item of items){
   const pos=item.x+':'+item.y;
   if(!coordinates.has(pos))coordinates.set(pos,[]);
   coordinates.get(pos).push(Object.freeze({kind,index:item.index,offset:item.offset}));
  }
 for(const [position,occupants] of coordinates)
  if(occupants.length>1&&occupants.some(o=>edits.has(key(o.kind,o.index))))
   collisions.push(Object.freeze({position,occupants:Object.freeze(occupants)}));
 const rawBytes=Object.freeze([...overlay].sort((a,b)=>a[0]-b[0])
  .map(([offset,value])=>Object.freeze({
   offset,expected:expectedBytes.get(offset),value
  })));
 return Object.freeze({
  bankIndex,mapIndex,mapCount,
  changes:Object.freeze(records),rawBytes,
  changedRecords:records.filter(r=>r.changedFields.length).length,
  changedBytes:rawBytes.filter(b=>b.expected!==b.value).length,
  colocatedDestinations:Object.freeze(collisions),
  unrelatedEventsPreserved:true,combinedReDecodeVerified:true,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  romAuthenticated:false,cubeLayoutAuthenticated:false,
  exclusiveOwnershipProven:false,authenticSaveReopenVerified:false
 });
}
/** Copy-only transaction of all event relocations with full rollback. */
export function verifyHmaCubeEventPositionBatchDryRun(source,summary,options={}){
 const rom=reader(source);
 if(rom.length<1||rom.length>64*1024*1024)
  throw new RangeError('Event batch rehearsal requires a 1–64 MiB ROM');
 const original=new Uint8Array(rom.length);
 for(let i=0;i<original.length;i++)original[i]=byte(rom,i);
 for(let i=0;i<original.length;i++)
  if(byte(rom,i)!==original[i])
   throw new RangeError('Source changed during ROM snapshot');
 const plan=previewHmaCubeEventPositionBatch(original,summary,options);
 const staged=original.slice();
 for(const patch of plan.rawBytes){
  if(staged[patch.offset]!==patch.expected)
   throw new RangeError('Stale event position byte during rehearsal');
  staged[patch.offset]=patch.value;
 }
 const after=inspectHmaCubeMapEventWarps(staged,summary,options);
 for(const record of plan.changes)
  if(!positionEqual(after.arrays[record.kind][record.index],record.after))
   throw new RangeError('Applied event batch differs from preflight');
 const allowed=new Set(plan.rawBytes.map(p=>p.offset));
 let changed=0;
 for(let i=0;i<staged.length;i++)if(staged[i]!==original[i]){
  if(!allowed.has(i))throw new RangeError('Event batch modified unrelated byte');
  changed++;
 }
 if(changed!==plan.changedBytes)
  throw new RangeError('Applied event batch changed-byte count mismatch');
 for(const patch of plan.rawBytes)staged[patch.offset]=patch.expected;
 for(let i=0;i<staged.length;i++)
  if(staged[i]!==original[i]||byte(rom,i)!==original[i])
   throw new RangeError('Event batch rollback or source preservation failed');
 return Object.freeze({
  changedRecords:plan.changedRecords,changedBytes:changed,
  colocatedDestinations:plan.colocatedDestinations,
  inMemoryReDecodeVerified:true,inMemoryRollbackVerified:true,
  unrelatedBytesPreserved:true,sourceBytesPreserved:true,
  patchedRomExported:false,authenticSaveReopenVerified:false,
  romAuthenticated:false,writeAuthorized:false,readOnly:true,copyOnly:true
 });
}
