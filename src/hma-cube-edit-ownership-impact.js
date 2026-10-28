/**
 * Source-grounded edit/ownership intersection audit for CUBE Emerald.
 * The pinned CUBHMA MapModel.cs defines 8-byte warp and fixed-width event
 * arrays. This report deliberately cannot establish global exclusivity:
 * explicitly counted banks are a partial view of ROM pointer ownership.
 *
 * No ROM bytes are written or exported; a clear report is NOT write approval.
 */
import {previewHmaCubeCellBatch} from './hma-cube-cell-batch.js';
import {previewHmaCubeWarpBatch} from './hma-cube-warp-batch.js';
import {previewHmaCubeEventPositionBatch} from './hma-cube-event-batch.js';
import {previewHmaCubeConnectionBatch} from './hma-cube-connection-edit.js';
import {previewHmaCubeScriptRetargetBatch} from './hma-cube-script-retarget.js';
import {auditHmaCubeCrossBankOwnership} from './hma-cube-cross-bank-ownership.js';
import {verifyHmaCubeCombinedTransaction} from './hma-cube-combined-transaction.js';

function addChanged(changes, offset, before, after, kind) {
 if(!Number.isSafeInteger(offset)||offset<0||
    !Number.isInteger(before)||before<0||before>255||
    !Number.isInteger(after)||after<0||after>255)
  throw new RangeError('Invalid planned CUBE edit byte');
 if(before!==after) {
  if(changes.has(offset))throw new RangeError('Overlapping changed CUBE edit bytes');
  changes.set(offset,kind);
 }
}
function warpBytes(w) {
 return [w.x&255,w.x>>>8,w.y&255,w.y>>>8,w.elevation,w.warpId,w.targetMap,w.targetBank];
}
function connectionBytes(r){
 const d=r.direction>>>0,o=r.rawDisplacement>>>0;
 return [d&255,(d>>>8)&255,(d>>>16)&255,(d>>>24)&255,
  o&255,(o>>>8)&255,(o>>>16)&255,(o>>>24)&255,
  r.targetBank,r.targetMap,r.unused&255,r.unused>>>8];
}
function intersectChanged(changes,start,length) {
 const offsets=[];
 for(const offset of changes.keys())if(offset>=start&&offset<start+length)
  offsets.push(offset);
 return offsets.sort((a,b)=>a-b);
}

/**
 * Correlate actual changed bytes in a validated, copy-only combined edit with
 * map/layout/blockmap/event claims across explicitly declared banks.
 *
 * Returns evidence and blockers, never a patched ROM, patches, or permission
 * to write. Unenumerated banks, aliases, script pointers and ROM identity
 * remain unresolved even when the bounded census has no intersections.
 */
export function auditHmaCubeEditOwnershipImpact(source,summary,options={}) {
 const {bankIndex,mapIndex,mapCount,banks,cells=[],warps=[],events=[],connections=[],scripts=[],
  targetBanks,x=0,y=0,viewportWidth=10,viewportHeight=8}=options;
 if(!Array.isArray(banks)||!banks.some(b=>
    b?.bankIndex===bankIndex&&b?.mapCount===mapCount))
  throw new RangeError('Ownership census must include exact edited bank and map count');
 const sourceId=bankIndex+':'+mapIndex;
 const opts={bankIndex,mapIndex,mapCount};
 // Rehearse the entire edit first, including a complete immutable snapshot,
 // re-decoding and rollback. No byte stream escapes this verifier.
 const rehearsal=verifyHmaCubeCombinedTransaction(source,summary,options);
 const changes=new Map();
 if(cells.length) {
  const plan=previewHmaCubeCellBatch(source,summary,{
   ...opts,changes:cells,banks,x,y,viewportWidth,viewportHeight
  });
  for(const r of plan.changes)for(let i=0;i<2;i++)
   addChanged(changes,r.byteOffset+i,r.before.bytes[i],r.after.bytes[i],'blockmap');
 }
 if(warps.length) {
  const plan=previewHmaCubeWarpBatch(source,summary,{
   ...opts,changes:warps,targetBanks
  });
  for(const r of plan.changes) {
   const before=warpBytes(r.before),after=warpBytes(r.after);
   for(let i=0;i<8;i++)
    addChanged(changes,r.sourceOffset+i,before[i],after[i],'event-warps');
  }
 }
 if(events.length) {
  const plan=previewHmaCubeEventPositionBatch(source,summary,{
   ...opts,changes:events
  });
  for(const r of plan.rawBytes)
   addChanged(changes,r.offset,r.expected,r.value,'event-position');
 }
 if(connections.length) {
  const plan=previewHmaCubeConnectionBatch(source,summary,{
   ...opts,changes:connections,targetBanks
  });
  for(const r of plan.changes) {
   const before=connectionBytes(r.before),after=connectionBytes(r.after);
   for(let i=0;i<12;i++)
    addChanged(changes,r.sourceOffset+i,before[i],after[i],'connection-records');
  }
 }
 if(scripts.length) {
  const plan=previewHmaCubeScriptRetargetBatch(source,summary,{
   ...opts,changes:scripts
  });
  for(const r of plan.rawBytes)
   addChanged(changes,r.offset,r.expected,r.value,'script-reference');
 }
 if(changes.size!==rehearsal.changedBytes)
  throw new RangeError('Ownership edit bytes disagree with combined rollback');
 const census=auditHmaCubeCrossBankOwnership(source,summary,{
  banks,includeEvents:true,includeConnections:true,includeMapScripts:true
 });
 const relevant=[...census.relationships,...census.sameMapRelationships];
 const conflicts=[];
 for(const relation of relevant) {
  if(relation.first!==sourceId&&relation.second!==sourceId)continue;
  const offsets=intersectChanged(changes,relation.overlapStart,relation.overlapBytes);
  if(!offsets.length)continue;
  conflicts.push(Object.freeze({
   first:relation.first,second:relation.second,
   firstKind:relation.firstKind,secondKind:relation.secondKind,
   sameMap:relation.first===relation.second,
   overlapStart:relation.overlapStart,
   overlapBytes:relation.overlapBytes,
   changedByteCount:offsets.length,
   changedKinds:Object.freeze([...new Set(offsets.map(i=>changes.get(i)))].sort())
  }));
 }
 const sourceDecoded=census.maps.some(m=>m.id===sourceId&&m.status==='decoded');
 const incomplete=census.invalid>0||census.eventIssues.length>0||
  census.connectionIssues.length>0||census.mapScriptIssues.length>0||!sourceDecoded;
 return Object.freeze({
  sourceMap:sourceId,changedBytes:changes.size,
  inspectedMaps:census.requestedMaps,decodedMaps:census.decoded,
  invalidMaps:census.invalid,eventIssueCount:census.eventIssues.length,
  connectionIssueCount:census.connectionIssues.length,
  mapScriptIssueCount:census.mapScriptIssues.length,
  mapScriptClaimsInspected:census.mapScriptClaimsInspected,
  conflicts:Object.freeze(conflicts),
  changedBytesTouchSharedClaims:conflicts.length>0,
  censusIncomplete:incomplete,
  noDetectedOverlapInInspectedMaps:conflicts.length===0&&!incomplete,
  copyOnlyRehearsalVerified:rehearsal.combinedReDecodeVerified&&
   rehearsal.inMemoryRollbackVerified&&rehearsal.sourceBytesPreserved,
  partialCoverage:true,globalPointerOwnershipProven:false,
  independentRomIdentityVerified:false,authenticSaveReopenVerified:false,
  exclusiveOwnershipProven:false,writeAuthorized:false,
  patchedRomExported:false,readOnly:true
 });
}
