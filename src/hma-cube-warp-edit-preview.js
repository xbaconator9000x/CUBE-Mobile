/**
 * CUBE Emerald 8-byte warp record preflight, source-grounded in pinned
 * kcradi/CUBHMA MapModel.cs WarpsFormat. This is an immutable virtual
 * comparison, NOT a ROM writer, independent authentication or gameplay test.
 */
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {traceHmaCubeWarpArrival} from './hma-cube-warp-arrival.js';

const fields=['x','y','elevation','warpId','targetMap','targetBank'];
function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected staged ROM reader');
}
function integer(n,max,name){
 if(!Number.isSafeInteger(n)||n<0||n>max)
  throw new RangeError(name+' outside raw field bounds');
}
function byte(rom,i){
 if(!Number.isSafeInteger(i)||i<0||i>=rom.length)
  throw new RangeError('Warp record byte outside ROM');
 const v=rom.read(i);
 integer(v,255,'ROM byte');
 return v;
}
function values(record){return Object.freeze(Object.fromEntries(fields.map(k=>[k,record[k]])));}
function same(a,b){return fields.every(k=>a[k]===b[k]);}
function destinations(targetBanks){
 if(targetBanks===undefined)return new Map();
 if(!Array.isArray(targetBanks)||targetBanks.length>8)
  throw new RangeError('At most eight explicitly counted target banks');
 const counts=new Map();
 for(const b of targetBanks){
  if(!b||!Number.isSafeInteger(b.bankIndex)||b.bankIndex<0||b.bankIndex>255||
     !Number.isSafeInteger(b.mapCount)||b.mapCount<1||b.mapCount>1024||
     counts.has(b.bankIndex))
   throw new RangeError('Duplicate or invalid destination-bank count');
  counts.set(b.bankIndex,b.mapCount);
 }
 return counts;
}
function trace(source,summary,opts,record,counts,declaredBankCount){
 if(record.specialTarget||record.warpId===255)
  return Object.freeze({status:'special-or-unresolved'});
 if(record.targetBank>=declaredBankCount)
  return Object.freeze({status:'outside-declared-bank-table'});
 if(!counts.has(record.targetBank))
  return Object.freeze({status:'target-bank-count-not-declared'});
 const result=traceHmaCubeWarpArrival(source,summary,{
  ...opts,warpIndex:record.index,targetMapCount:counts.get(record.targetBank)
 });
 return Object.freeze({status:result.status,
  ...(result.arrival?{arrival:result.arrival}:{}),
  ...(result.targetWarpCount!==undefined?{targetWarpCount:result.targetWarpCount}:{})});
}

/**
 * Verify exact original fields, apply one warp record to a virtual accessor,
 * re-decode all source warps and compare raw destination traces. The output
 * never includes a ROM, a patch or write authority.
 */
export function previewHmaCubeWarpRecordChange(source,summary,{
 bankIndex,mapIndex,mapCount,warpIndex,expected,proposed,targetBanks
}={}){
 const rom=reader(source),opts={bankIndex,mapIndex,mapCount};
 const before=inspectHmaCubeMapEventWarps(rom,summary,opts);
 integer(warpIndex,before.warps.length-1,'Warp index');
 const record=before.warps[warpIndex];
 if(!expected||typeof expected!=='object'||!fields.every(k=>Object.hasOwn(expected,k)))
  throw new RangeError('Exact six-field expected warp record required');
 for(const k of fields)integer(expected[k],k==='x'||k==='y'?65535:255,'Expected '+k);
 if(!same(record,expected))
  throw new RangeError('Warp record changed since selection; inspect again');
 if(!proposed||typeof proposed!=='object'||
    !Object.keys(proposed).length||Object.keys(proposed).some(k=>!fields.includes(k)))
  throw new RangeError('Provide at least one supported warp field proposal');
 const next={...values(record),...proposed};
 for(const k of fields)integer(next[k],k==='x'||k==='y'?65535:255,'Proposed '+k);
 if(next.x>=before.map.layout.width||next.y>=before.map.layout.height)
  throw new RangeError('Proposed warp coordinates outside declared map');
 const counts=destinations(targetBanks);
 const raw=[next.x&255,next.x>>>8,next.y&255,next.y>>>8,
  next.elevation,next.warpId,next.targetMap,next.targetBank];
 const overlay=new Map(raw.map((v,i)=>[record.offset+i,v]));
 // Revalidate all original bytes before returning a virtual result.
 const original=[record.x&255,record.x>>>8,record.y&255,record.y>>>8,
  record.elevation,record.warpId,record.targetMap,record.targetBank];
 for(let i=0;i<8;i++)if(byte(rom,record.offset+i)!==original[i])
  throw new RangeError('Warp source bytes changed during preflight');
 const staged=Object.freeze({length:rom.length,read:i=>
  overlay.has(i)?overlay.get(i):byte(rom,i)});
 const after=inspectHmaCubeMapEventWarps(staged,summary,opts);
 if(after.warps.length!==before.warps.length||
    after.warps[warpIndex].offset!==record.offset||
    !same(after.warps[warpIndex],next))
  throw new RangeError('Warp record virtual re-decode failed');
 for(let i=0;i<before.warps.length;i++)
  if(i!==warpIndex&&(!same(before.warps[i],after.warps[i])||
      before.warps[i].offset!==after.warps[i].offset))
   throw new RangeError('Unrelated warp changed during virtual preview');
 const beforeTrace=trace(rom,summary,opts,record,counts,before.map.declaredBankCount);
 const afterTrace=trace(staged,summary,opts,after.warps[warpIndex],counts,after.map.declaredBankCount);
 return Object.freeze({
  bankIndex,mapIndex,mapCount,warpIndex,sourceOffset:record.offset,
  before:values(record),after:values(after.warps[warpIndex]),
  changedFields:Object.freeze(fields.filter(k=>record[k]!==next[k])),
  beforeTrace,afterTrace,
  proposedCoordinatesInBounds:true,otherWarpsPreserved:true,
  destinationCountsExplicit:counts.size>0,
  readOnly:true,previewOnly:true,writeAuthorized:false,
  romAuthenticated:false,cubeLayoutAuthenticated:false,
  exclusiveOwnershipProven:false,emulatorVerified:false,
  authenticSaveReopenVerified:false
 });
}

/**
 * Copy-only reversible transaction rehearsal. Copies the bounded ROM into
 * isolated memory, applies only the preflighted eight-byte warp record,
 * re-decodes and compares raw destination evidence, then rolls back.
 * This never exports bytes, writes a source ROM, or grants write authority.
 */
export function verifyHmaCubeWarpRecordDryRun(source,summary,options={}){
 const rom=reader(source);
 if(rom.length<1||rom.length>64*1024*1024)
  throw new RangeError('Warp copy-only rehearsal requires 1–64 MiB');
 const original=new Uint8Array(rom.length);
 for(let i=0;i<rom.length;i++)original[i]=byte(rom,i);
 for(let i=0;i<rom.length;i++)if(byte(rom,i)!==original[i])
  throw new RangeError('Source changed while copying ROM snapshot');
 const preview=previewHmaCubeWarpRecordChange(original,summary,options);
 const staged=original.slice(),at=preview.sourceOffset;
 const before=[preview.before.x&255,preview.before.x>>>8,
  preview.before.y&255,preview.before.y>>>8,preview.before.elevation,
  preview.before.warpId,preview.before.targetMap,preview.before.targetBank];
 const after=[preview.after.x&255,preview.after.x>>>8,
  preview.after.y&255,preview.after.y>>>8,preview.after.elevation,
  preview.after.warpId,preview.after.targetMap,preview.after.targetBank];
 for(let i=0;i<8;i++){
  if(staged[at+i]!==before[i])
   throw new RangeError('Warp source changed before isolated apply');
  staged[at+i]=after[i];
 }
 let changedBytes=0;
 for(let i=0;i<staged.length;i++)if(staged[i]!==original[i]){
  if(i<at||i>=at+8||staged[i]!==after[i-at])
   throw new RangeError('Isolated warp transaction changed an unplanned byte');
  changedBytes++;
 }
 const decoded=inspectHmaCubeMapEventWarps(staged,summary,{
  bankIndex:options.bankIndex,mapIndex:options.mapIndex,mapCount:options.mapCount
 });
 const next=decoded.warps[options.warpIndex];
 if(!next||next.offset!==at||!same(next,preview.after))
  throw new RangeError('Isolated warp transaction failed raw re-decode');
 const replay=previewHmaCubeWarpRecordChange(staged,summary,{
  ...options,expected:preview.after,proposed:preview.after
 });
 if(!same(replay.before,preview.after)||
    JSON.stringify(replay.beforeTrace)!==JSON.stringify(preview.afterTrace)||
    !replay.otherWarpsPreserved)
  throw new RangeError('Isolated warp destination trace differs from virtual preview');
 for(let i=0;i<8;i++)staged[at+i]=before[i];
 for(let i=0;i<staged.length;i++)if(staged[i]!==original[i])
  throw new RangeError('Isolated warp transaction rollback failed');
 for(let i=0;i<rom.length;i++)if(byte(rom,i)!==original[i])
  throw new RangeError('Source ROM changed during copy-only rehearsal');
 return Object.freeze({
  sourceOffset:at,warpIndex:options.warpIndex,changedBytes,
  inMemoryReDecodeVerified:true,inMemoryRollbackVerified:true,
  sourceBytesPreserved:true,unrelatedBytesPreserved:true,
  beforeTrace:preview.beforeTrace,afterTrace:preview.afterTrace,
  sourceBytesExported:false,patchedRomExported:false,
  authenticSaveReopenVerified:false,romAuthenticated:false,
  exclusiveOwnershipProven:false,writeAuthorized:false,
  readOnly:true,copyOnly:true
 });
}
