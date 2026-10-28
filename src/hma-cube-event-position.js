/**
 * Conservative CUBE Emerald event-position preflight.
 * Pinned kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc
 * MapModel.cs: objects 24 bytes, script triggers 16, signposts 12.
 * Only x/y and the exact elevation field are understood. All unknown
 * event bytes, pointers, scripts, and flags are preserved byte-for-byte.
 * No semantic ROM writes or compatibility claims.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';

const kinds=Object.freeze({
 objects:Object.freeze({coordOffset:4,elevationOffset:8,elevationBytes:1}),
 scripts:Object.freeze({coordOffset:0,elevationOffset:4,elevationBytes:2}),
 signposts:Object.freeze({coordOffset:0,elevationOffset:4,elevationBytes:1})
});
function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected staged ROM reader');
}
function byte(rom,offset){
 if(!Number.isSafeInteger(offset)||offset<0||offset>=rom.length)
  throw new RangeError('Event record byte outside ROM');
 const v=rom.read(offset);
 if(!Number.isInteger(v)||v<0||v>255)
  throw new RangeError('Invalid ROM byte in event preflight');
 return v;
}
function integer(value,max,name){
 if(!Number.isSafeInteger(value)||value<0||value>max)
  throw new RangeError(name+' outside supported raw field range');
}
function recordFields(record){
 return Object.freeze({x:record.x,y:record.y,elevation:record.elevation});
}
function same(a,b){return a.x===b.x&&a.y===b.y&&a.elevation===b.elevation;}
function encoded(value,count){
 return Array.from({length:count},(_,i)=>(value>>>(8*i))&255);
}
/** Preview exactly one source-grounded event position change. */
export function previewHmaCubeEventPositionChange(source,summary,{
 bankIndex,mapIndex,mapCount,kind,index,expected,proposed
}={}){
 const rom=reader(source),opts={bankIndex,mapIndex,mapCount};
 if(!Object.hasOwn(kinds,kind))
  throw new RangeError('Only objects, scripts and signposts support position edits');
 const spec=kinds[kind];
 const before=inspectHmaCubeMapEventWarps(rom,summary,opts);
 if(!Number.isSafeInteger(index)||index<0||index>=before.arrays[kind].length)
  throw new RangeError('Event index outside decoded array');
 const record=before.arrays[kind][index];
 if(!expected||Object.keys(expected).length!==3||
    !['x','y','elevation'].every(k=>Object.hasOwn(expected,k)))
  throw new RangeError('Exact x/y/elevation expected fields required');
 integer(expected.x,65535,'Expected x');
 integer(expected.y,65535,'Expected y');
 integer(expected.elevation,spec.elevationBytes===2?65535:255,'Expected elevation');
 if(!same(record,expected))
  throw new RangeError('Event position changed since selection');
 if(!proposed||typeof proposed!=='object'||!Object.keys(proposed).length||
    Object.keys(proposed).some(k=>!['x','y','elevation'].includes(k)))
  throw new RangeError('Specify supported position fields');
 const next={...recordFields(record),...proposed};
 integer(next.x,65535,'Proposed x');
 integer(next.y,65535,'Proposed y');
 integer(next.elevation,spec.elevationBytes===2?65535:255,'Proposed elevation');
 if(next.x>=before.map.layout.width||next.y>=before.map.layout.height)
  throw new RangeError('Proposed event position outside declared map');
 const start=record.offset,original=new Map(),overlay=new Map();
 for(const [offset,bytes] of [
  [start+spec.coordOffset,encoded(record.x,2)],
  [start+spec.coordOffset+2,encoded(record.y,2)],
  [start+spec.elevationOffset,encoded(record.elevation,spec.elevationBytes)]
 ])bytes.forEach((v,i)=>original.set(offset+i,v));
 for(const [offset,bytes] of [
  [start+spec.coordOffset,encoded(next.x,2)],
  [start+spec.coordOffset+2,encoded(next.y,2)],
  [start+spec.elevationOffset,encoded(next.elevation,spec.elevationBytes)]
 ])bytes.forEach((v,i)=>overlay.set(offset+i,v));
 for(const [offset,v] of original)
  if(byte(rom,offset)!==v)
   throw new RangeError('Event bytes changed during position preflight');
 const staged=Object.freeze({length:rom.length,
  read:i=>overlay.has(i)?overlay.get(i):byte(rom,i)});
 const after=inspectHmaCubeMapEventWarps(staged,summary,opts);
 if(after.arrays[kind].length!==before.arrays[kind].length||
    !same(after.arrays[kind][index],next))
  throw new RangeError('Virtual event position failed re-decode');
 for(const name of Object.keys(before.arrays)){
  if(before.arrays[name].length!==after.arrays[name].length)
   throw new RangeError('Virtual edit changed event array length');
  for(let i=0;i<before.arrays[name].length;i++){
   if(name===kind&&i===index)continue;
   if(JSON.stringify(before.arrays[name][i])!==JSON.stringify(after.arrays[name][i]))
    throw new RangeError('Virtual edit modified an unrelated event');
  }
 }
 const conflicts=[];
 for(const [name,items] of Object.entries(after.arrays))
  for(const item of items)
   if(!(name===kind&&item.index===index)&&
      item.x===next.x&&item.y===next.y)
    conflicts.push(Object.freeze({kind:name,index:item.index,offset:item.offset}));
 return Object.freeze({
  kind,index,sourceOffset:start,before:recordFields(record),
  after:recordFields(after.arrays[kind][index]),
  changedFields:Object.freeze(['x','y','elevation'].filter(k=>record[k]!==next[k])),
  rawBytes:Object.freeze([...overlay].sort((a,b)=>a[0]-b[0]).map(([offset,value])=>
   Object.freeze({offset,expected:original.get(offset),value}))),
  colocatedEvents:Object.freeze(conflicts),
  unrelatedEventsPreserved:true,virtualReDecodeVerified:true,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  romAuthenticated:false,cubeLayoutAuthenticated:false,
  exclusiveOwnershipProven:false,authenticSaveReopenVerified:false
 });
}
/** Isolated copy-only apply, re-decode and full rollback of an event move. */
export function verifyHmaCubeEventPositionDryRun(source,summary,options={}){
 const rom=reader(source);
 if(rom.length<1||rom.length>64*1024*1024)
  throw new RangeError('Event rehearsal requires a 1–64 MiB ROM');
 const original=new Uint8Array(rom.length);
 for(let i=0;i<rom.length;i++)original[i]=byte(rom,i);
 for(let i=0;i<rom.length;i++)
  if(byte(rom,i)!==original[i])
   throw new RangeError('Source changed during ROM snapshot');
 const plan=previewHmaCubeEventPositionChange(original,summary,options);
 const staged=original.slice();
 for(const change of plan.rawBytes){
  if(staged[change.offset]!==change.expected)
   throw new RangeError('Event byte changed before isolated apply');
  staged[change.offset]=change.value;
 }
 const after=inspectHmaCubeMapEventWarps(staged,summary,options);
 if(!same(after.arrays[plan.kind][plan.index],plan.after))
  throw new RangeError('Isolated event re-decode failed');
 let changed=0;
 const allowed=new Set(plan.rawBytes.map(b=>b.offset));
 for(let i=0;i<staged.length;i++)if(staged[i]!==original[i]){
  if(!allowed.has(i))throw new RangeError('Unrelated ROM byte modified');
  changed++;
 }
 for(const change of plan.rawBytes)staged[change.offset]=change.expected;
 for(let i=0;i<original.length;i++)
  if(staged[i]!==original[i]||byte(rom,i)!==original[i])
   throw new RangeError('Event rollback or source preservation failed');
 return Object.freeze({
  kind:plan.kind,index:plan.index,changedBytes:changed,
  colocatedEvents:plan.colocatedEvents,
  inMemoryReDecodeVerified:true,inMemoryRollbackVerified:true,
  unrelatedBytesPreserved:true,sourceBytesPreserved:true,
  patchedRomExported:false,authenticSaveReopenVerified:false,
  romAuthenticated:false,writeAuthorized:false,readOnly:true,copyOnly:true
 });
}
