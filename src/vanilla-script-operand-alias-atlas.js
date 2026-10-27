/**
 * Read-only, whole-declared-atlas alias hints for decoded vanilla event-script
 * pointer OPERANDS (message, movement, branch, ASM, trainer battle, etc.).
 *
 * Sources: pinned kcradi/CUBHMA MapModel.cs event pointer records and
 * scriptReference.txt / ScriptParser.cs fixed-width command signatures.
 * Structural aliasing is not allocation ownership, target-format validation,
 * CUBE grammar authentication, or permission to edit a ROM.
 */
import {auditVanillaAtlasWideScriptAliases} from './vanilla-script-alias-atlas.js';
import {inspectVanillaEventScriptPointers} from './map-events.js';
import {auditVanillaScriptOperandPointers} from './vanilla-script-operand-pointers.js';

export function auditVanillaAtlasScriptOperandAliases(source,atlas,{
 maxMaps=4096,maxPointerFields=32768,maxScripts=4096,
 maxOperandFields=65536,maxGroups=64,maxReferences=16,
 maxBytes=64,maxCommands=16
}={}){
 if(!Number.isSafeInteger(maxScripts)||maxScripts<1||maxScripts>4096||
    !Number.isSafeInteger(maxOperandFields)||maxOperandFields<1||
    maxOperandFields>65536||
    !Number.isSafeInteger(maxGroups)||maxGroups<1||maxGroups>128||
    !Number.isSafeInteger(maxReferences)||maxReferences<1||maxReferences>32||
    !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256||
    !Number.isSafeInteger(maxCommands)||maxCommands<1||maxCommands>16)
  throw new RangeError('Invalid whole-atlas operand audit budget');
 // This gate independently re-derives canonical bank/map provenance from
 // ROM bytes. Never trust a caller-forged atlas pointer source or map order.
 const verified=auditVanillaAtlasWideScriptAliases(source,atlas,{
  maxMaps,maxPointerFields,maxGroups:1,maxReferences:1
 });
 const roots=new Map();
 let eventScriptReferences=0;
 for(const map of atlas.maps){
  const pointers=inspectVanillaEventScriptPointers(source,{
   address:map.mapHeaderOffset,family:atlas.family
  });
  for(const record of pointers.records){
   if(record.status!=='in-rom')continue;
   eventScriptReferences++;
   let root=roots.get(record.targetOffset);
   if(!root){
    root={address:record.targetOffset,ownerCount:0};
    roots.set(record.targetOffset,root);
    if(roots.size>maxScripts)
     throw new RangeError('Distinct event-script budget exceeded; no partial result');
   }
   root.ownerCount++;
  }
 }
 const targets=new Map();
 let operandFields=0,inRomOperandFields=0,decodedScripts=0;
 const stopReasons={};
 for(const root of roots.values()){
  const audit=auditVanillaScriptOperandPointers(source,{
   address:root.address,family:atlas.family,
   maxBytes,maxCommands,maxFindings:64
  });
  if(audit.truncated)
   throw new RangeError('Operand findings truncated; no partial result');
  if(audit.decodedCommands)decodedScripts++;
  stopReasons[audit.stopReason]=(stopReasons[audit.stopReason]||0)+1;
  operandFields+=audit.total;
  if(operandFields>maxOperandFields)
   throw new RangeError('Operand field budget exceeded; no partial result');
  for(const finding of audit.findings){
   if(finding.status!=='in-rom')continue;
   inRomOperandFields++;
   let group=targets.get(finding.targetOffset);
   if(!group){
    group={targetOffset:finding.targetOffset,sources:new Map()};
    targets.set(finding.targetOffset,group);
   }
   // One decoded command can be referenced by multiple event roots or
   // overlapping script prefixes. Count distinct pointer SOURCE bytes,
   // not repeated traversal of the same ROM operand.
   if(!group.sources.has(finding.pointerSourceOffset))
    group.sources.set(finding.pointerSourceOffset,Object.freeze({
     pointerSourceOffset:finding.pointerSourceOffset,
     scriptOffset:root.address,role:finding.role,
     eventRootReferences:root.ownerCount
    }));
  }
 }
 const shared=[...targets.values()].filter(g=>g.sources.size>1)
  .sort((a,b)=>a.targetOffset-b.targetOffset);
 const groups=shared.slice(0,maxGroups).map(g=>{
  const all=[...g.sources.values()];
  return Object.freeze({
   targetOffset:g.targetOffset,sourceCount:all.length,
   references:Object.freeze(all.slice(0,maxReferences)),
   referencesTruncated:all.length>maxReferences
  });
 });
 return Object.freeze({
  mapsInspected:verified.mapsInspected,
  eventScriptPointerFields:verified.pointerFields,
  eventScriptReferences,distinctEventScripts:roots.size,
  decodedScripts,operandFields,inRomOperandFields,
  distinctOperandTargets:targets.size,totalGroups:shared.length,
  groups:Object.freeze(groups),truncated:shared.length>groups.length,
  stopReasons:Object.freeze(stopReasons),
  wholeDeclaredAtlas:true,readOnly:true,
  layoutAuthenticated:false,grammarAuthenticated:false,
  ownershipAuthenticated:false,targetFormatVerified:false,
  scriptLengthVerified:false,controlFlowFollowed:false,
  writeAuthorized:false,independentParityEvidence:false
 });
}
