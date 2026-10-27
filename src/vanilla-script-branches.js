/**
 * Read-only vanilla event-script branch pointer audit.
 * The fixed-width command prefix is decoded by the conservative upstream-
 * grounded inspector. This module NEVER follows a branch or treats a pointer
 * as proof of executable ownership, script validity, or CUBE compatibility.
 */
import {inspectVanillaScriptCommandPrefix} from './vanilla-script-prefix.js';

const BRANCH_OPCODES=new Set([0x04,0x05,0x06,0x07]);
export function auditVanillaScriptBranchTargets(source,{
 address,family,maxBytes=128,maxCommands=32,maxFindings=32
}={}){
 if(!Number.isSafeInteger(maxFindings)||maxFindings<1||maxFindings>64)
  throw new RangeError('Branch finding limit must be 1–64');
 const prefix=inspectVanillaScriptCommandPrefix(source,{
  address,family,maxBytes,maxCommands
 });
 const commands=prefix.commands;
 const findings=[];let total=0;
 const counts={commandStart:0,insideCommand:0,outsidePrefix:0,
  outsideRom:0,nonRom:0,null:0};
 for(const command of commands){
  if(!BRANCH_OPCODES.has(command.opcode))continue;
  const arg=command.args.find(a=>a.type==='pointer');
  if(!arg||!arg.target)throw new RangeError('Decoded branch lacks pointer');
  const target=arg.target;
  let status;
  if(target.status==='null')status='null';
  else if(target.status==='outside-rom')status='outside-rom';
  else if(target.status==='non-rom')status='non-rom';
  else{
   const exact=commands.find(c=>c.offset===target.offset);
   const middle=commands.find(c=>c.offset<target.offset&&
    target.offset<c.offset+c.length);
   status=exact?'command-start':middle?'inside-command':'outside-prefix';
  }
  const key={ 'command-start':'commandStart',
   'inside-command':'insideCommand','outside-prefix':'outsidePrefix',
   'outside-rom':'outsideRom','non-rom':'nonRom','null':'null'}[status];
  counts[key]++;total++;
  if(findings.length<maxFindings)findings.push(Object.freeze({
   commandOffset:command.offset,commandName:command.name,
   pointerSourceOffset:arg.offset,rawPointer:target.raw,
   targetOffset:target.offset,status,
   selfTarget:target.offset===command.offset,
   targetIsKnownCommand:status==='command-start'
  }));
 }
 return Object.freeze({
  address,family,total,counts:Object.freeze(counts),
  findings:Object.freeze(findings),truncated:total>findings.length,
  decodedCommands:commands.length,stopReason:prefix.stopReason,
  stopOffset:prefix.stopOffset,
  readOnly:true,layoutAuthenticated:false,grammarAuthenticated:false,
  scriptLengthVerified:false,controlFlowFollowed:false,
  ownershipVerified:false,writeAuthorized:false
 });
}
