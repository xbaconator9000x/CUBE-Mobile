/**
 * Atomic, raw CUBE Emerald connection-record preview and copy-only rollback.
 * Source: pinned CUBHMA MapModel.cs ConnectionsFormat:
 * [direction:: offset:: mapGroup. mapNum. unused:] (12 bytes).
 * This does not infer valid directions, map reachability or write permission.
 */
import {inspectHmaCubeMapConnections} from './hma-cube-map-connections.js';

const fields=Object.freeze(['direction','rawDisplacement','targetBank','targetMap','unused']);
const maxima=Object.freeze({
 direction:0xFFFFFFFF,rawDisplacement:0xFFFFFFFF,
 targetBank:255,targetMap:255,unused:65535
});
function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected bounded staged ROM reader');
}
function byte(rom,offset){
 if(!Number.isSafeInteger(offset)||offset<0||offset>=rom.length)
  throw new RangeError('Connection byte outside ROM');
 const n=rom.read(offset);
 if(!Number.isInteger(n)||n<0||n>255)
  throw new RangeError('Invalid staged connection byte');
 return n;
}
function valid(n,key){
 if(!Number.isSafeInteger(n)||n<0||n>maxima[key])
  throw new RangeError('Connection '+key+' outside raw field bounds');
 return n;
}
function values(record){
 return Object.freeze(Object.fromEntries(fields.map(key=>[key,record[key]])));
}
function same(a,b){return fields.every(k=>a[k]===b[k]);}
function encode(record){
 const d=record.direction>>>0,o=record.rawDisplacement>>>0;
 return [d&255,(d>>>8)&255,(d>>>16)&255,(d>>>24)&255,
  o&255,(o>>>8)&255,(o>>>16)&255,(o>>>24)&255,
  record.targetBank,record.targetMap,record.unused&255,record.unused>>>8];
}
function targetStatus(record,banks){
 if(banks===undefined)return 'destination-count-not-declared';
 if(!Array.isArray(banks)||banks.length>8)
  throw new RangeError('Declare at most eight destination banks');
 const seen=new Set();
 for(const b of banks){
  if(!b||!Number.isSafeInteger(b.bankIndex)||b.bankIndex<0||b.bankIndex>255||
     !Number.isSafeInteger(b.mapCount)||b.mapCount<1||b.mapCount>1024||
     seen.has(b.bankIndex))
   throw new RangeError('Invalid or duplicate connection destination declaration');
  seen.add(b.bankIndex);
 }
 const b=banks.find(x=>x.bankIndex===record.targetBank);
 if(!b)return 'destination-bank-not-declared';
 return record.targetMap<b.mapCount?'within-explicit-count':'outside-explicit-count';
}
/**
 * Validate 1–32 distinct connection records against the original source,
 * virtually overlay raw fields, re-decode the complete connection array and
 * check every unrelated record. All output is a preview, not ROM data.
 */
export function previewHmaCubeConnectionBatch(source,summary,{
 bankIndex,mapIndex,mapCount,changes,targetBanks
}={}){
 const rom=reader(source);
 if(!Array.isArray(changes)||changes.length<1||changes.length>32)
  throw new RangeError('Provide 1–32 connection proposals');
 const opts={bankIndex,mapIndex,mapCount};
 const before=inspectHmaCubeMapConnections(rom,summary,opts);
 const seen=new Set(),overlay=new Map(),records=[];
 for(const change of changes){
  if(!change||!Number.isSafeInteger(change.connectionIndex)||
     change.connectionIndex<0||change.connectionIndex>=before.connections.length||
     seen.has(change.connectionIndex))
   throw new RangeError('Invalid or duplicate connection index');
  seen.add(change.connectionIndex);
  const old=before.connections[change.connectionIndex];
  if(!change.expected||typeof change.expected!=='object'||
     !fields.every(k=>Object.hasOwn(change.expected,k))||
     fields.some(k=>valid(change.expected[k],k)!==old[k]))
   throw new RangeError('Stale or incomplete expected connection fields');
  if(!change.proposed||typeof change.proposed!=='object'||
     !Object.keys(change.proposed).length||
     Object.keys(change.proposed).some(k=>!fields.includes(k)))
   throw new RangeError('Connection proposal needs supported raw fields');
  const next={...values(old),...change.proposed};
  for(const key of fields)valid(next[key],key);
  const oldBytes=encode(old),newBytes=encode(next);
  for(let i=0;i<12;i++){
   const offset=old.offset+i;
   if(overlay.has(offset))throw new RangeError('Overlapping connection records');
   if(byte(rom,offset)!==oldBytes[i])
    throw new RangeError('Connection source changed during preflight');
   overlay.set(offset,newBytes[i]);
  }
  records.push(Object.freeze({
   connectionIndex:change.connectionIndex,sourceOffset:old.offset,
   before:values(old),after:Object.freeze({...next}),
   changedFields:Object.freeze(fields.filter(k=>old[k]!==next[k])),
   targetStatus:targetStatus(next,targetBanks)
  }));
 }
 // Revalidate every expected byte before reading the virtual array.
 for(const r of records){
  const expected=encode(r.before);
  for(let i=0;i<12;i++)
   if(byte(rom,r.sourceOffset+i)!==expected[i])
    throw new RangeError('Connection source changed before combined preview');
 }
 const virtual=Object.freeze({length:rom.length,
  read:i=>overlay.has(i)?overlay.get(i):byte(rom,i)});
 const after=inspectHmaCubeMapConnections(virtual,summary,opts);
 if(after.count!==before.count||after.arrayOffset!==before.arrayOffset)
  throw new RangeError('Connection array changed structure');
 const byIndex=new Map(records.map(r=>[r.connectionIndex,r]));
 for(let i=0;i<before.connections.length;i++){
  const expected=byIndex.get(i)?.after??before.connections[i];
  if(after.connections[i].offset!==before.connections[i].offset||
     !same(after.connections[i],expected))
   throw new RangeError('Connection re-decode differs from proposed records');
 }
 const changedBytes=records.reduce((sum,r)=>{
  const a=encode(r.before),b=encode(r.after);
  return sum+a.filter((v,i)=>v!==b[i]).length;
 },0);
 return Object.freeze({
  bankIndex,mapIndex,mapCount,
  changes:Object.freeze(records),
  changedRecords:records.filter(r=>r.changedFields.length).length,
  changedBytes,combinedReDecodeVerified:true,unrelatedConnectionsPreserved:true,
  destinationCountsAuthenticated:false,globalOwnershipProven:false,
  romAuthenticated:false,authenticSaveReopenVerified:false,
  writeAuthorized:false,readOnly:true,previewOnly:true
 });
}
/**
 * Apply to an isolated full-ROM snapshot, re-decode and reverse all changed
 * bytes, then verify source immutability. No ROM or patch bytes escape.
 */
export function verifyHmaCubeConnectionBatchDryRun(source,summary,options={}){
 const rom=reader(source);
 if(rom.length<1||rom.length>64*1024*1024)
  throw new RangeError('Connection rehearsal requires 1–64 MiB ROM');
 const original=new Uint8Array(rom.length);
 for(let i=0;i<original.length;i++)original[i]=byte(rom,i);
 for(let i=0;i<original.length;i++)
  if(byte(rom,i)!==original[i])
   throw new RangeError('Connection source changed during snapshot');
 const plan=previewHmaCubeConnectionBatch(original,summary,options);
 const staged=original.slice(),allowed=new Set();
 for(const record of plan.changes){
  const before=encode(record.before),after=encode(record.after);
  for(let i=0;i<12;i++){
   const offset=record.sourceOffset+i;
   if(staged[offset]!==before[i])
    throw new RangeError('Stale connection byte during isolated apply');
   staged[offset]=after[i];allowed.add(offset);
  }
 }
 const decoded=inspectHmaCubeMapConnections(staged,summary,options);
 for(const record of plan.changes)
  if(!same(decoded.connections[record.connectionIndex],record.after))
   throw new RangeError('Applied connection record differs from preflight');
 let changed=0;
 for(let i=0;i<staged.length;i++)if(staged[i]!==original[i]){
  if(!allowed.has(i))throw new RangeError('Connection edit touched unrelated byte');
  changed++;
 }
 if(changed!==plan.changedBytes)
  throw new RangeError('Connection changed-byte count mismatch');
 for(const record of plan.changes){
  const before=encode(record.before);
  for(let i=0;i<12;i++)staged[record.sourceOffset+i]=before[i];
 }
 for(let i=0;i<original.length;i++)
  if(staged[i]!==original[i]||byte(rom,i)!==original[i])
   throw new RangeError('Connection rollback or source preservation failed');
 return Object.freeze({
  changedRecords:plan.changedRecords,changedBytes:changed,
  inMemoryReDecodeVerified:true,inMemoryRollbackVerified:true,
  unrelatedBytesPreserved:true,sourceBytesPreserved:true,
  patchedRomExported:false,authenticSaveReopenVerified:false,
  exclusiveOwnershipProven:false,romAuthenticated:false,
  writeAuthorized:false,readOnly:true,copyOnly:true
 });
}
