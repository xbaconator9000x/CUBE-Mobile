/**
 * Bounded read-only audit of vanilla object/trigger event-script targets.
 * Reuses the pinned-CUBHMA fixed-width prefix and branch inspectors.
 * In-ROM pointers and decodable bytes do NOT authenticate script ownership.
 * No branch traversal, ROM writes, CUBE grammar assumptions or ROM bytes exported.
 */
import {inspectVanillaEventScriptPointers} from './map-events.js';
import {inspectVanillaScriptCommandPrefix} from './vanilla-script-prefix.js';
import {auditVanillaScriptBranchTargets} from './vanilla-script-branches.js';

export function auditVanillaMapEventScripts(source,{
 address,family,maxRecords=32,maxBytes=64,maxCommands=16
}={}){
 if(!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>64)
  throw new RangeError('Script record budget must be 1–64');
 const pointers=inspectVanillaEventScriptPointers(source,{address,family});
 const records=[],counts={inRom:0,null:0,nonRom:0,outsideRom:0,
  decoded:0,unknownOpcode:0,truncatedCommand:0,terminal:0};
 for(const record of pointers.records.slice(0,maxRecords)){
  counts[record.status==='in-rom'?'inRom':record.status==='outside-rom'?
   'outsideRom':record.status==='non-rom'?'nonRom':'null']++;
  let preview=null;
  if(record.status==='in-rom'){
   const decoded=inspectVanillaScriptCommandPrefix(source,{
    address:record.targetOffset,family,maxBytes,maxCommands});
   const branches=auditVanillaScriptBranchTargets(source,{
    address:record.targetOffset,family,maxBytes,maxCommands,maxFindings:16});
   if(decoded.commands.length)counts.decoded++;
   if(decoded.stopReason==='unknown-opcode')counts.unknownOpcode++;
   if(decoded.stopReason==='truncated-command'||decoded.stopReason==='rom-end')
    counts.truncatedCommand++;
   if(decoded.stopReason==='terminal')counts.terminal++;
   preview=Object.freeze({
    decodedCommands:decoded.commands.length,
    firstCommand:decoded.commands[0]?.name??null,
    stopReason:decoded.stopReason,stopOffset:decoded.stopOffset,
    branchCount:branches.total,
    branchStatuses:branches.counts,
    branchesTruncated:branches.truncated
   });
  }
  records.push(Object.freeze({
   kind:record.kind,index:record.index,
   pointerSourceOffset:record.sourceOffset,
   pointerStatus:record.status,targetOffset:record.targetOffset,
   preview
  }));
 }
 return Object.freeze({
  address,family,totalRecords:pointers.records.length,
  inspectedRecords:records.length,
  truncated:pointers.records.length>records.length,
  counts:Object.freeze(counts),records:Object.freeze(records),
  readOnly:true,layoutAuthenticated:false,grammarAuthenticated:false,
  ownershipVerified:false,controlFlowFollowed:false,
  writeAuthorized:false,independentParityEvidence:false
 });
}
