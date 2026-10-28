/**
 * Conservative CUBHMA CUBE Emerald script-reference retargeting.
 * Pinned upstream: kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc,
 * Models/Map/MapModel.cs: ObjectsFormat, ScriptsFormat, SignpostsFormat.
 *
 * A signpost kind 5/6/7 encodes a hidden item in the pointer union. Never
 * interpret that union as a script address or overwrite it. Script-bearing
 * signposts are only kinds 0..4. No script bytes are parsed or executed.
 * Targets are copied ONLY from existing same-map script references. A valid
 * in-ROM pointer is not proof of a valid script or of ROM authenticity.
 * This module never exports patched ROM bytes or authorizes a write.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';

const KINDS=Object.freeze(['objects','scripts','signposts']);
function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>0&&typeof source.read==='function')return source;
 throw new TypeError('Expected bounded read-only ROM');
}
function byte(rom,i){
 if(!Number.isSafeInteger(i)||i<0||i>=rom.length)throw RangeError('Script byte outside ROM');
 const n=rom.read(i);
 if(!Number.isInteger(n)||n<0||n>255)throw RangeError('Invalid ROM accessor byte');
 return n;
}
function u32(rom,at){return (byte(rom,at)|(byte(rom,at+1)<<8)|(byte(rom,at+2)<<16)|(byte(rom,at+3)<<24))>>>0;}
function bytes32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];}
function raw(record,kind){return kind==='signposts'?record.rawArgument:record.scriptPointer;}
function at(record,kind){return kind==='signposts'?record.offset+8:record.scriptPointerSource;}
function validTarget(pointer,length){
 if(pointer<0x08000000||pointer>=0x0A000000)return null;
 const offset=pointer-0x08000000;
 return offset<length?offset:null;
}
function eligible(record,kind){return kind!=='signposts'||record.kind<5;}
function checkKind(kind){if(!KINDS.includes(kind))throw RangeError('Unsupported script-reference kind');}
function get(events,kind,index){
 checkKind(kind);
 if(!Number.isSafeInteger(index)||index<0||index>=events.arrays[kind].length)
  throw RangeError('Script-reference index outside decoded array');
 const record=events.arrays[kind][index];
 if(!eligible(record,kind))throw RangeError('Hidden-item or unsupported signpost union is not a script pointer');
 return record;
}
function ranges(events){
 const m=events.map,rs=[
  [m.header.address,28],[m.layout.address,28],
  [m.layout.blockmapOffset,m.layout.blockmapBytes]
 ];
 if(events.eventsOffset!==null)rs.push([events.eventsOffset,20]);
 for(const [kind,size] of [['objects',24],['warps',8],['scripts',16],['signposts',12]])
  if(events.offsets[kind]!==null)rs.push([events.offsets[kind],events.counts[kind]*size]);
 return rs;
}
function safeTarget(pointer,events,length){
 const offset=validTarget(pointer,length);
 if(offset===null)return null;
 // Refuse to redirect into known local map structures. Other ROM regions
 // are not globally classified, so even a pass remains unverified.
 return ranges(events).some(([start,size])=>offset>=start&&offset<start+size)?null:offset;
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

/** Enumerate pointer-bearing records and hidden-item unions separately. */
export function inspectHmaCubeScriptReferences(source,summary,options={}){
 const rom=reader(source),events=inspectHmaCubeMapEventWarps(rom,summary,options),references=[];
 for(const kind of KINDS)for(const record of events.arrays[kind]){
  const scriptBearing=eligible(record,kind);
  const pointer=scriptBearing?raw(record,kind):null;
  const offset=scriptBearing?safeTarget(pointer,events,rom.length):null;
  references.push(Object.freeze({kind,index:record.index,sourceOffset:at(record,kind),
   scriptBearing,hiddenItemUnion:kind==='signposts'&&!scriptBearing,
   rawPointer:pointer,targetOffset:offset,
   inRomNonstructuralTarget:offset!==null,scriptSemanticsVerified:false}));
 }
 return Object.freeze({references:Object.freeze(references),
  scriptBearingCount:references.filter(r=>r.scriptBearing).length,
  hiddenItemUnionCount:references.filter(r=>r.hiddenItemUnion).length,
  validInRomTargetCount:references.filter(r=>r.inRomNonstructuralTarget).length,
  readOnly:true,romAuthenticated:false,scriptSemanticsVerified:false,
  exclusiveOwnershipProven:false,writeAuthorized:false});
}

/**
 * Retarget up to 32 existing script-pointer fields to pointers already used by
 * another script-bearing event on this same map. No arbitrary target address
 * is accepted. Expected raw words are mandatory and stale checked.
 */
export function previewHmaCubeScriptRetargetBatch(source,summary,{
 bankIndex,mapIndex,mapCount,changes
}={}){
 const rom=reader(source),opts={bankIndex,mapIndex,mapCount};
 if(!Array.isArray(changes)||changes.length<1||changes.length>32)
  throw RangeError('Provide 1–32 script-reference proposals');
 const before=inspectHmaCubeMapEventWarps(rom,summary,opts);
 const seen=new Set(),overlay=new Map(),patches=[],records=[];
 for(const change of changes){
  if(!change||!Number.isSafeInteger(change.expectedRaw)||change.expectedRaw<0||
     change.expectedRaw>0xFFFFFFFF)throw RangeError('Expected raw script pointer required');
  const sourceRecord=get(before,change.kind,change.index);
  const targetRecord=get(before,change.targetKind,change.targetIndex);
  const id=change.kind+':'+change.index;
  if(seen.has(id))throw RangeError('Duplicate script-reference proposal');
  seen.add(id);
  const previous=raw(sourceRecord,change.kind),next=raw(targetRecord,change.targetKind);
  if(previous!==change.expectedRaw)throw RangeError('Stale expected script pointer');
  if(safeTarget(next,before,rom.length)===null)
   throw RangeError('Target is not an existing safe in-ROM script reference');
  if(previous===next)throw RangeError('Script-reference proposal does not change target');
  const offset=at(sourceRecord,change.kind);
  const oldBytes=bytes32(previous),newBytes=bytes32(next);
  if(u32(rom,offset)!==previous)throw RangeError('Script pointer source bytes changed');
  for(let i=0;i<4;i++){
   if(overlay.has(offset+i))throw RangeError('Overlapping script pointer fields');
   overlay.set(offset+i,newBytes[i]);
   patches.push(Object.freeze({offset:offset+i,expected:oldBytes[i],value:newBytes[i]}));
  }
  records.push(Object.freeze({kind:change.kind,index:change.index,sourceOffset:offset,
   beforeRaw:previous,afterRaw:next,targetKind:change.targetKind,
   targetIndex:change.targetIndex}));
 }
 const staged=Object.freeze({length:rom.length,read:i=>overlay.has(i)?overlay.get(i):byte(rom,i)});
 const after=inspectHmaCubeMapEventWarps(staged,summary,opts);
 const edits=new Map(records.map(r=>[r.kind+':'+r.index,r]));
 for(const kind of ['objects','warps','scripts','signposts']){
  if(before.arrays[kind].length!==after.arrays[kind].length)
   throw RangeError('Script edit changed event array structure');
  for(let i=0;i<before.arrays[kind].length;i++){
   const b=before.arrays[kind][i],a=after.arrays[kind][i],edit=edits.get(kind+':'+i);
   if(edit){
    const expected={...b};
    if(kind==='signposts')expected.rawArgument=edit.afterRaw;
    else expected.scriptPointer=edit.afterRaw;
    if(!same(a,expected))throw RangeError('Script-reference re-decode mismatch');
   }else if(!same(a,b))throw RangeError('Unrelated event changed during script retarget');
  }
 }
 for(const patch of patches)
  if(byte(rom,patch.offset)!==patch.expected)
   throw RangeError('Source changed during script pointer preview');
 return Object.freeze({changes:Object.freeze(records),
  rawBytes:Object.freeze(patches.sort((a,b)=>a.offset-b.offset)),
  changedRecords:records.length,
  changedBytes:patches.filter(p=>p.expected!==p.value).length,
  completeEventReDecodeVerified:true,unrelatedEventsPreserved:true,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  scriptSemanticsVerified:false,romAuthenticated:false,
  exclusiveOwnershipProven:false,patchedRomExported:false});
}

/** Apply to an isolated snapshot, re-decode, restore and prove source intact. */
export function verifyHmaCubeScriptRetargetDryRun(source,summary,options={}){
 const rom=reader(source);
 if(rom.length<1||rom.length>64*1024*1024)
  throw RangeError('Script transaction requires a 1–64 MiB ROM');
 const original=new Uint8Array(rom.length);
 for(let i=0;i<rom.length;i++)original[i]=byte(rom,i);
 for(let i=0;i<rom.length;i++)if(byte(rom,i)!==original[i])
  throw RangeError('ROM changed during script transaction snapshot');
 const plan=previewHmaCubeScriptRetargetBatch(original,summary,options);
 const staged=original.slice();
 for(const patch of plan.rawBytes){
  if(staged[patch.offset]!==patch.expected)throw RangeError('Stale script pointer byte');
  staged[patch.offset]=patch.value;
 }
 const after=inspectHmaCubeMapEventWarps(staged,summary,options);
 for(const edit of plan.changes)
  if(raw(after.arrays[edit.kind][edit.index],edit.kind)!==edit.afterRaw)
   throw RangeError('Staged script pointer differs from preview');
 let changed=0;
 const allowed=new Set(plan.rawBytes.map(p=>p.offset));
 for(let i=0;i<staged.length;i++)if(staged[i]!==original[i]){
  if(!allowed.has(i))throw RangeError('Unplanned script transaction change');
  changed++;
 }
 if(changed!==plan.changedBytes)throw RangeError('Script changed-byte count mismatch');
 for(const patch of plan.rawBytes)staged[patch.offset]=patch.expected;
 for(let i=0;i<rom.length;i++)
  if(staged[i]!==original[i]||byte(rom,i)!==original[i])
   throw RangeError('Script transaction rollback or source preservation failed');
 return Object.freeze({changedRecords:plan.changedRecords,changedBytes:changed,
  completeEventReDecodeVerified:true,inMemoryRollbackVerified:true,
  unrelatedBytesPreserved:true,sourceBytesPreserved:true,
  patchedRomExported:false,authenticSaveReopenVerified:false,
  romAuthenticated:false,scriptSemanticsVerified:false,
  writeAuthorized:false,readOnly:true,copyOnly:true});
}
