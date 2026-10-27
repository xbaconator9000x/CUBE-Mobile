/**
 * Read-only provenance for pointer operands in the bounded vanilla command
 * prefix. Grounded in pinned CUBHMA scriptReference.txt signatures.
 * A pointer role is a command-level hint, NOT verified target ownership,
 * valid text/movement data, or executable CUBE script grammar.
 */
import {inspectVanillaScriptCommandPrefix} from './vanilla-script-prefix.js';

const ROLES=Object.freeze({
  0x04:'script-branch',0x05:'script-branch',
  0x06:'script-branch',0x07:'script-branch',
  0x0f:'generic-data',0x23:'asm',0x24:'code',
  0x4f:'movement-data',0x50:'movement-data',0x67:'message-text'
});

export function auditVanillaScriptOperandPointers(source,{
 address,family,maxBytes=128,maxCommands=32,maxFindings=32
}={}){
 if(!Number.isSafeInteger(maxFindings)||maxFindings<1||maxFindings>64)
  throw new RangeError('Operand pointer finding limit must be 1–64');
 const prefix=inspectVanillaScriptCommandPrefix(source,{
  address,family,maxBytes,maxCommands
 });
 const findings=[],statuses={inRom:0,outsideRom:0,nonRom:0,null:0};
 const roles={scriptBranch:0,genericData:0,asm:0,code:0,
  movementData:0,messageText:0};
 let total=0;
 for(const command of prefix.commands){
  for(const arg of command.args){
   if(arg.type!=='pointer')continue;
   const role=ROLES[command.opcode];
   if(!role)throw new RangeError('Unclassified vanilla pointer operand');
   const status=arg.target.status;
   const statusKey={'in-rom':'inRom','outside-rom':'outsideRom',
    'non-rom':'nonRom',null:'null'}[status];
   const roleKey={'script-branch':'scriptBranch',
    'generic-data':'genericData',asm:'asm',code:'code',
    'movement-data':'movementData','message-text':'messageText'}[role];
   if(!statusKey||!roleKey)throw new RangeError('Invalid pointer classification');
   statuses[statusKey]++;roles[roleKey]++;total++;
   if(findings.length<maxFindings)findings.push(Object.freeze({
    commandOffset:command.offset,commandName:command.name,
    pointerSourceOffset:arg.offset,rawPointer:arg.value,
    targetOffset:arg.target.offset,status,role
   }));
  }
 }
 return Object.freeze({address,family,total,
  findings:Object.freeze(findings),truncated:total>findings.length,
  statuses:Object.freeze(statuses),roles:Object.freeze(roles),
  decodedCommands:prefix.commands.length,stopReason:prefix.stopReason,
  readOnly:true,layoutAuthenticated:false,grammarAuthenticated:false,
  ownershipVerified:false,targetFormatVerified:false,
  controlFlowFollowed:false,writeAuthorized:false,
  independentParityEvidence:false});
}
