/**
 * Conservative cross-kind CUBE map transaction rehearsal.
 * All changes are independently source-validated and then applied atomically
 * to a private copy. This is NOT a persisted ROM editor or write authorization.
 */
import {previewHmaCubeCellBatch} from './hma-cube-cell-batch.js';
import {previewHmaCubeWarpBatch} from './hma-cube-warp-batch.js';
import {previewHmaCubeEventPositionBatch} from './hma-cube-event-batch.js';
import {previewHmaCubeConnectionBatch} from './hma-cube-connection-edit.js';
import {previewHmaCubeScriptRetargetBatch} from './hma-cube-script-retarget.js';
import {inspectHmaCubeMapConnections} from './hma-cube-map-connections.js';
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {renderHmaCubeMapViewport} from './hma-cube-map-render.js';
import {auditHmaCubeWarpTopology} from './hma-cube-warp-arrival.js';

const warpFields=['x','y','elevation','warpId','targetMap','targetBank'];
const connectionFields=['direction','rawDisplacement','targetBank','targetMap','unused'];
function connectionBytes(r){const d=r.direction>>>0,o=r.rawDisplacement>>>0;return [d&255,(d>>>8)&255,(d>>>16)&255,(d>>>24)&255,o&255,(o>>>8)&255,(o>>>16)&255,(o>>>24)&255,r.targetBank,r.targetMap,r.unused&255,r.unused>>>8];}
function connectionValues(r){return Object.fromEntries(connectionFields.map(k=>[k,r[k]]));}
function warpBytes(w){return [w.x&255,w.x>>>8,w.y&255,w.y>>>8,w.elevation,w.warpId,w.targetMap,w.targetBank];}
function reader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>0&&typeof source.read==='function')
  return source;
 throw new TypeError('Expected bounded read-only ROM');
}
function byte(rom,i){
 if(!Number.isSafeInteger(i)||i<0||i>=rom.length)throw RangeError('ROM byte outside bounds');
 const n=rom.read(i);
 if(!Number.isInteger(n)||n<0||n>255)throw RangeError('Invalid ROM accessor byte');
 return n;
}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function mapFields(r){return {x:r.x,y:r.y,elevation:r.elevation};}
function warpValues(r){return Object.fromEntries(warpFields.map(k=>[k,r[k]]));}
function register(patches,offset,expected,value,kind){
 if(!Number.isSafeInteger(offset)||offset<0||offset>=64*1024*1024)
  throw RangeError('Patch offset outside safe ROM bounds');
 if(patches.has(offset))throw RangeError('Cross-kind transaction overlaps a previously claimed byte');
 patches.set(offset,Object.freeze({offset,expected,value,kind}));
}
/**
 * Rehearse optional map cells, warps, events, raw connections and script pointers together.
 * At least one nonempty kind is required. All plans use the same unmodified
 * source, and no generated ROM bytes are returned to callers.
 */
export function verifyHmaCubeCombinedTransaction(source,summary,{
 bankIndex,mapIndex,mapCount,cells=[],warps=[],events=[],connections=[],scripts=[],
 targetBanks,banks,x=0,y=0,viewportWidth=10,viewportHeight=8,targetRom
}={}){
 const rom=reader(source);
 if(rom.length<1||rom.length>64*1024*1024)
  throw RangeError('Combined transaction requires a 1–64 MiB ROM');
 if(!Array.isArray(cells)||!Array.isArray(warps)||!Array.isArray(events)||
    !Array.isArray(connections)||!Array.isArray(scripts)||cells.length>32||warps.length>32||
    events.length>32||connections.length>32||scripts.length>32||
    !(cells.length||warps.length||events.length||connections.length||scripts.length))
  throw RangeError('Provide 1–32 proposals per kind, at least one kind');
 const opts={bankIndex,mapIndex,mapCount},patches=new Map();
 const cellPlan=cells.length?previewHmaCubeCellBatch(rom,summary,{
  ...opts,changes:cells,banks,x,y,viewportWidth,viewportHeight
 }):null;
 const warpPlan=warps.length?previewHmaCubeWarpBatch(rom,summary,{
  ...opts,changes:warps,targetBanks
 }):null;
 const eventPlan=events.length?previewHmaCubeEventPositionBatch(rom,summary,{
  ...opts,changes:events
 }):null;
 const connectionPlan=connections.length?previewHmaCubeConnectionBatch(rom,summary,{
  ...opts,changes:connections,targetBanks
 }):null;
 const scriptPlan=scripts.length?previewHmaCubeScriptRetargetBatch(rom,summary,{
  ...opts,changes:scripts
 }):null;
 if(cellPlan)for(const record of cellPlan.changes){
  for(let j=0;j<2;j++)register(patches,record.byteOffset+j,
   record.before.bytes[j],record.after.bytes[j],'cell');
 }
 if(warpPlan)for(const record of warpPlan.changes){
  const before=warpBytes(record.before),after=warpBytes(record.after);
  for(let j=0;j<8;j++)register(patches,record.sourceOffset+j,before[j],after[j],'warp');
 }
 if(eventPlan)for(const patch of eventPlan.rawBytes)
  register(patches,patch.offset,patch.expected,patch.value,'event');
 if(scriptPlan)for(const patch of scriptPlan.rawBytes)
  register(patches,patch.offset,patch.expected,patch.value,'script-reference');
 if(connectionPlan)for(const record of connectionPlan.changes){
  const before=connectionBytes(record.before),after=connectionBytes(record.after);
  for(let j=0;j<12;j++)register(patches,record.sourceOffset+j,before[j],after[j],'connection');
 }
 for(const patch of patches.values())
  if(byte(rom,patch.offset)!==patch.expected)
   throw RangeError('Source changed during cross-kind preflight');
 const original=new Uint8Array(rom.length);
 for(let i=0;i<rom.length;i++)original[i]=byte(rom,i);
 for(let i=0;i<rom.length;i++)
  if(byte(rom,i)!==original[i])
   throw RangeError('Source changed during combined transaction snapshot');
 const staged=original.slice();
 for(const patch of patches.values()){
  if(staged[patch.offset]!==patch.expected)
   throw RangeError('Stale original byte in combined transaction');
  staged[patch.offset]=patch.value;
 }
 const afterEvents=(warpPlan||eventPlan||scriptPlan)?
  inspectHmaCubeMapEventWarps(staged,summary,opts):null;
 if(warpPlan){
  for(const record of warpPlan.changes)
   if(!equal(warpValues(afterEvents.warps[record.warpIndex]),warpValues(record.after)))
    throw RangeError('Combined warp re-decode differs from preview');
  const afterTopology=auditHmaCubeWarpTopology(staged,summary,{
   ...opts,targetBanks,maxWarps:64
  });
  if(!equal(afterTopology.records,warpPlan.afterTopology.records))
   throw RangeError('Combined warp topology differs from preview');
 }
 if(eventPlan)for(const record of eventPlan.changes)
  if(!equal(mapFields(afterEvents.arrays[record.kind][record.index]),record.after))
   throw RangeError('Combined event position differs from preview');
 if(scriptPlan){
  for(const record of scriptPlan.changes){
   const decoded=afterEvents.arrays[record.kind][record.index];
   const raw=record.kind==='signposts'?decoded.rawArgument:decoded.scriptPointer;
   if(raw!==record.afterRaw)
    throw RangeError('Combined script-reference re-decode differs from preview');
  }
 }
 if(connectionPlan){
  const beforeConnections=inspectHmaCubeMapConnections(original,summary,opts);
  const afterConnections=inspectHmaCubeMapConnections(staged,summary,opts);
  if(afterConnections.count!==beforeConnections.count||
     afterConnections.arrayOffset!==beforeConnections.arrayOffset)
   throw RangeError('Combined connection array changed structure');
  const changed=new Map(connectionPlan.changes.map(r=>[r.connectionIndex,r]));
  for(let i=0;i<beforeConnections.connections.length;i++){
   const expected=changed.get(i)?.after??beforeConnections.connections[i];
   if(afterConnections.connections[i].offset!==beforeConnections.connections[i].offset||
      !equal(connectionValues(afterConnections.connections[i]),connectionValues(expected)))
    throw RangeError('Combined connection re-decode differs from preview');
  }
 }
 if(cellPlan){
  const afterImage=renderHmaCubeMapViewport(staged,summary,{
   ...opts,x,y,viewportWidth,viewportHeight
  });
  if(!equal(afterImage.cells,cellPlan.afterImage.cells)||
     !equal(afterImage.attributes,cellPlan.afterImage.attributes)||
     afterImage.pixels.length!==cellPlan.afterImage.pixels.length||
     !afterImage.pixels.every((n,i)=>n===cellPlan.afterImage.pixels[i]))
   throw RangeError('Combined map render differs from cell preview');
 }
 let changedBytes=0;
 for(let i=0;i<staged.length;i++)if(staged[i]!==original[i]){
  const patch=patches.get(i);
  if(!patch||patch.value!==staged[i])
   throw RangeError('Combined transaction modified an unplanned ROM byte');
  changedBytes++;
 }
 // Optional read-only acceptance: compare a separately replayed BPS target
 // against EVERY byte of the independently constructed semantic preview.
 // A match is evidence of exact proposal replay, NEVER write authorization.
 if(targetRom!==undefined){
  if(!(targetRom instanceof Uint8Array)||targetRom.length!==original.length)
   throw new RangeError('BPS target ROM length or type differs from semantic preview');
  for(let i=0;i<staged.length;i++)
   if(targetRom[i]!==staged[i])
    throw new RangeError('BPS target contains an undeclared or missing semantic byte');
 }
 for(const patch of patches.values())staged[patch.offset]=patch.expected;
 for(let i=0;i<staged.length;i++)
  if(staged[i]!==original[i]||byte(rom,i)!==original[i])
   throw RangeError('Combined transaction rollback or source preservation failed');
 return Object.freeze({
  cellChanges:cellPlan?.changedCells??0,
  warpChanges:warpPlan?.changedRecords??0,
  eventChanges:eventPlan?.changedRecords??0,
  connectionChanges:connectionPlan?.changedRecords??0,
  scriptChanges:scriptPlan?.changedRecords??0,
  claimedBytes:patches.size,changedBytes,
  combinedReDecodeVerified:true,inMemoryRollbackVerified:true,
  unrelatedBytesPreserved:true,sourceBytesPreserved:true,
  targetReplayMatched:targetRom===undefined?false:true,
  patchedRomExported:false,authenticSaveReopenVerified:false,
  exclusiveOwnershipProven:false,romAuthenticated:false,
  writeAuthorized:false,copyOnly:true,readOnly:true
 });
}
