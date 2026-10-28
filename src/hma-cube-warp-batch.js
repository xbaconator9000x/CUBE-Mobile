/**
 * Atomic, multi-record CUBE Emerald warp transaction rehearsal.
 * Pinned upstream: kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc,
 * MapModel.cs WarpsFormat (8 bytes: x/y u16, elevation, warp ID, map, bank).
 * This module NEVER exports or persists a modified ROM. Matching a metadata
 * shape does not authenticate a CUBE ROM or grant semantic write authority.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {previewHmaCubeWarpRecordChange} from './hma-cube-warp-edit-preview.js';
import {auditHmaCubeWarpTopology} from './hma-cube-warp-arrival.js';

const fields=['x','y','elevation','warpId','targetMap','targetBank'];
function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected bounded staged ROM reader');
}
function byte(rom,offset){
 if(!Number.isSafeInteger(offset)||offset<0||offset>=rom.length)
  throw new RangeError('Warp byte outside ROM');
 const n=rom.read(offset);
 if(!Number.isInteger(n)||n<0||n>255)
  throw new RangeError('Invalid ROM accessor byte');
 return n;
}
function bytesOf(warp){
 return [warp.x&255,warp.x>>>8,warp.y&255,warp.y>>>8,
  warp.elevation,warp.warpId,warp.targetMap,warp.targetBank];
}
function equalFields(a,b){return fields.every(field=>a[field]===b[field]);}
function sameTopology(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function validateBanks(targetBanks,bankIndex,mapCount){
 if(!Array.isArray(targetBanks)||targetBanks.length<1||targetBanks.length>8)
  throw new RangeError('Declare 1–8 destination banks for topology audit');
 const seen=new Set();
 for(const entry of targetBanks){
  if(!entry||!Number.isSafeInteger(entry.bankIndex)||entry.bankIndex<0||
     entry.bankIndex>255||!Number.isSafeInteger(entry.mapCount)||
     entry.mapCount<1||entry.mapCount>1024||seen.has(entry.bankIndex))
   throw new RangeError('Invalid or duplicate destination bank declaration');
  seen.add(entry.bankIndex);
 }
 if(!targetBanks.some(entry=>entry.bankIndex===bankIndex&&entry.mapCount===mapCount))
  throw new RangeError('Destination declarations must include exact source bank count');
}
/**
 * Preview up to 32 distinct warp records as one atomic overlay. Each proposal
 * is independently checked against the ORIGINAL bytes, never earlier changes
 * in the same batch. Combined destination traces are then recomputed, so
 * two edited warps pointing at each other are evaluated together.
 */
export function previewHmaCubeWarpBatch(source,summary,{
 bankIndex,mapIndex,mapCount,changes,targetBanks
}={}){
 const rom=reader(source);
 if(!Array.isArray(changes)||changes.length<1||changes.length>32)
  throw new RangeError('Provide 1–32 warp record proposals');
 validateBanks(targetBanks,bankIndex,mapCount);
 const opts={bankIndex,mapIndex,mapCount};
 const original=inspectHmaCubeMapEventWarps(rom,summary,opts);
 if(original.warps.length>64)
  throw new RangeError('Warp topology exceeds 64-record audit budget');
 const overlay=new Map(),indices=new Set(),records=[];
 for(const change of changes){
  if(!change||!Number.isSafeInteger(change.warpIndex)||
     indices.has(change.warpIndex))
   throw new RangeError('Duplicate or invalid warp index in batch');
  indices.add(change.warpIndex);
  const preview=previewHmaCubeWarpRecordChange(rom,summary,{
   ...opts,...change,targetBanks
  });
  const oldBytes=bytesOf(preview.before),newBytes=bytesOf(preview.after);
  for(let j=0;j<8;j++){
   const offset=preview.sourceOffset+j;
   if(overlay.has(offset))
    throw new RangeError('Overlapping warp records in batch');
   if(byte(rom,offset)!==oldBytes[j])
    throw new RangeError('Warp source changed during batch validation');
   overlay.set(offset,newBytes[j]);
  }
  records.push(Object.freeze({
   warpIndex:change.warpIndex,sourceOffset:preview.sourceOffset,
   before:preview.before,after:preview.after,
   changedFields:preview.changedFields
  }));
 }
 // Ensure a mutable reader cannot change the source between validations.
 for(const record of records){
  const originalBytes=bytesOf(record.before);
  for(let j=0;j<8;j++)
   if(byte(rom,record.sourceOffset+j)!==originalBytes[j])
    throw new RangeError('Warp source changed before combined preview');
 }
 const staged=Object.freeze({length:rom.length,
  read:i=>overlay.has(i)?overlay.get(i):byte(rom,i)});
 const combined=inspectHmaCubeMapEventWarps(staged,summary,opts);
 if(combined.warps.length!==original.warps.length||
    combined.map.layout.blockmapOffset!==original.map.layout.blockmapOffset)
  throw new RangeError('Warp batch changed source map structure');
 const byIndex=new Map(records.map(record=>[record.warpIndex,record]));
 for(let i=0;i<original.warps.length;i++){
  const expected=byIndex.get(i)?.after??original.warps[i];
  if(combined.warps[i].offset!==original.warps[i].offset||
     !equalFields(combined.warps[i],expected))
   throw new RangeError('Combined warp re-decode differs from proposed records');
 }
 const beforeTopology=auditHmaCubeWarpTopology(rom,summary,{
  ...opts,targetBanks,maxWarps:64
 });
 const afterTopology=auditHmaCubeWarpTopology(staged,summary,{
  ...opts,targetBanks,maxWarps:64
 });
 return Object.freeze({
  bankIndex,mapIndex,mapCount,
  changes:Object.freeze(records),changedRecords:records.filter(r=>r.changedFields.length).length,
  changedBytes:records.reduce((n,r)=>{
   const a=bytesOf(r.before),b=bytesOf(r.after);
   return n+a.filter((v,i)=>v!==b[i]).length;
  },0),
  beforeTopology,afterTopology,
  topologyChanged:!sameTopology(beforeTopology.records,afterTopology.records),
  unrelatedWarpsPreserved:true,combinedReDecodeVerified:true,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  romAuthenticated:false,cubeLayoutAuthenticated:false,
  exclusiveOwnershipProven:false,authenticSaveReopenVerified:false
 });
}
/**
 * Apply the complete batch to an isolated copy, re-decode and audit it,
 * reverse every byte, and verify the original source was never modified.
 * A successful rehearsal is NOT a persisted ROM roundtrip or emulator test.
 */
export function verifyHmaCubeWarpBatchDryRun(source,summary,options={}){
 const rom=reader(source);
 if(rom.length<1||rom.length>64*1024*1024)
  throw new RangeError('Warp batch rehearsal requires a 1–64 MiB ROM');
 const original=new Uint8Array(rom.length);
 for(let i=0;i<original.length;i++)original[i]=byte(rom,i);
 for(let i=0;i<original.length;i++)
  if(byte(rom,i)!==original[i])
   throw new RangeError('Source changed during ROM snapshot');
 const plan=previewHmaCubeWarpBatch(original,summary,options);
 const staged=original.slice();
 for(const record of plan.changes){
  const before=bytesOf(record.before),after=bytesOf(record.after);
  for(let i=0;i<8;i++){
   if(staged[record.sourceOffset+i]!==before[i])
    throw new RangeError('Stale warp record during atomic rehearsal');
   staged[record.sourceOffset+i]=after[i];
  }
 }
 const replay=previewHmaCubeWarpBatch(staged,summary,{
  ...options,changes:plan.changes.map(r=>({
   warpIndex:r.warpIndex,expected:r.after,proposed:r.after
  }))
 });
 if(!sameTopology(replay.beforeTopology.records,plan.afterTopology.records)||
    !replay.combinedReDecodeVerified)
  throw new RangeError('Applied batch topology differs from preview');
 const allowed=new Set();
 for(const record of plan.changes)
  for(let i=0;i<8;i++)allowed.add(record.sourceOffset+i);
 let changed=0;
 for(let i=0;i<staged.length;i++)if(staged[i]!==original[i]){
  if(!allowed.has(i))
   throw new RangeError('Batch changed an unrelated ROM byte');
  changed++;
 }
 if(changed!==plan.changedBytes)
  throw new RangeError('Changed-byte count differs from preflight');
 for(const record of plan.changes){
  const before=bytesOf(record.before);
  for(let i=0;i<8;i++)staged[record.sourceOffset+i]=before[i];
 }
 for(let i=0;i<original.length;i++)
  if(staged[i]!==original[i]||byte(rom,i)!==original[i])
   throw new RangeError('Warp batch rollback or source preservation failed');
 return Object.freeze({
  changedRecords:plan.changedRecords,changedBytes:changed,
  inMemoryReDecodeVerified:true,inMemoryRollbackVerified:true,
  unrelatedBytesPreserved:true,sourceBytesPreserved:true,
  beforeTopology:plan.beforeTopology,afterTopology:plan.afterTopology,
  sourceBytesExported:false,patchedRomExported:false,
  authenticSaveReopenVerified:false,writeAuthorized:false,
  romAuthenticated:false,exclusiveOwnershipProven:false,
  readOnly:true,copyOnly:true
 });
}
