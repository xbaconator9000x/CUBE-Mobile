/**
 * Conservative read-only decoder for a SMALL vanilla RSE/FRLG event-script
 * command prefix. Source: pinned kcradi/CUBHMA
 * src/HexManiac.Core/Models/Code/scriptReference.txt and ScriptParser.cs.
 *
 * Only opcodes with an unambiguous fixed-width signature are recognized.
 * The first unknown opcode, incomplete command or terminal stops decoding.
 * No control-flow following, ASM execution, script ownership inference,
 * ROM writes, CUBE expansion opcode support or script-length claim.
 */
const VANILLA_COMMANDS=Object.freeze({
  0x00:['nop',[]],0x01:['nop1',[]],0x02:['end',[]],
  0x03:['return',[]],0x04:['call',['pointer']],
  0x05:['goto',['pointer']],0x06:['if1',['byte','pointer']],
  0x07:['if2',['byte','pointer']],0x08:['gotostd',['byte']],
  0x09:['callstd',['byte']],0x0a:['gotostdif',['byte','byte']],
  0x0b:['callstdif',['byte','byte']],
  0x0f:['loadpointer',['byte','pointer']],
  0x10:['setbyte2',['byte','byte']],
  0x16:['setvar',['word','word']],0x17:['addvar',['word','word']],
  0x18:['subvar',['word','word']],0x19:['copyvar',['word','word']],
  0x1a:['setorcopyvar',['word','word']],
  0x21:['compare',['word','word']],0x22:['comparevars',['word','word']],
  0x23:['callasm',['pointer']],0x24:['setcode',['pointer']],
  0x25:['special',['word']],0x26:['special2',['word','word']],
  0x27:['waitstate',[]],0x28:['pause',['word']],
  0x29:['setflag',['word']],0x2a:['clearflag',['word']],
  0x2b:['checkflag',['word']],0x30:['waitsound',[]],
  0x31:['fanfare',['word']],0x32:['waitfanfare',[]]
});
const VANILLA_TERMINALS=new Set([0x02,0x03,0x05,0x08,0x24,0x27]);
const ARG_WIDTH=Object.freeze({byte:1,word:2,pointer:4});
function scriptReader(source){
 if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
 if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&
    typeof source.read==='function')return source;
 throw new TypeError('Expected ROM bytes or a read-only ROM accessor');
}
function readScriptByte(rom,offset){
 const n=rom.read(offset);
 if(!Number.isInteger(n)||n<0||n>255)
  throw new RangeError('Invalid ROM byte from script accessor');
 return n;
}
function pointerDescription(raw,romLength){
 if(raw===0)return Object.freeze({raw,status:'null',offset:null});
 if(raw>=0x08000000&&raw<0x0a000000){
  const offset=raw-0x08000000;
  return Object.freeze({raw,status:offset<romLength?'in-rom':'outside-rom',
    offset:offset<romLength?offset:null});
 }
 return Object.freeze({raw,status:'non-rom',offset:null});
}
/**
 * Decode up to maxBytes and maxCommands from a caller-supplied script offset.
 * Byte budget and command count are HARD limits, not a guessed script length.
 */
export function inspectVanillaScriptCommandPrefix(source,{
 address,family,maxBytes=64,maxCommands=32
}={}){
 const rom=scriptReader(source);
 if(family!=='RSE'&&family!=='FRLG')
  throw new RangeError('Explicit vanilla RSE or FRLG family required');
 if(!Number.isSafeInteger(address)||address<0||address>=rom.length)
  throw new RangeError('Script start outside ROM');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256||
    !Number.isSafeInteger(maxCommands)||maxCommands<1||maxCommands>64)
  throw new RangeError('Script inspection limits must be 1–256 bytes and 1–64 commands');
 const limit=Math.min(rom.length,address+maxBytes);
 const commands=[];let cursor=address,stopReason='byte-budget',stopOffset=cursor;
 while(cursor<limit&&commands.length<maxCommands){
  const opcode=readScriptByte(rom,cursor);
  const signature=VANILLA_COMMANDS[opcode];
  if(!signature){stopReason='unknown-opcode';stopOffset=cursor;break;}
  const [name,types]=signature;
  const length=1+types.reduce((n,type)=>n+ARG_WIDTH[type],0);
  if(length>limit-cursor){
   stopReason=cursor+length>rom.length?'rom-end':'truncated-command';
   stopOffset=cursor;break;
  }
  const bytes=[];
  for(let i=0;i<length;i++)bytes.push(readScriptByte(rom,cursor+i));
  const args=[];let pos=1;
  for(const type of types){
   const size=ARG_WIDTH[type];let value=0;
   for(let j=0;j<size;j++)value+=(bytes[pos+j]*2**(j*8));
   args.push(Object.freeze({type,value,offset:cursor+pos,
    ...(type==='pointer'?{target:pointerDescription(value,rom.length)}:{})}));
   pos+=size;
  }
  commands.push(Object.freeze({offset:cursor,opcode,name,length,
    bytes:Object.freeze(bytes),args:Object.freeze(args),
    terminal:VANILLA_TERMINALS.has(opcode)}));
  cursor+=length;
  if(VANILLA_TERMINALS.has(opcode)){
   stopReason='terminal';stopOffset=cursor;break;
  }
 }
 if(cursor>=limit&&stopReason==='byte-budget')
  stopReason=cursor>=rom.length?'rom-end':'byte-budget';
 else if(commands.length>=maxCommands&&stopReason==='byte-budget')
  stopReason='command-budget';
 stopOffset=cursor;
 return Object.freeze({address,family,requestedBytes:maxBytes,
  inspectedBytes:cursor-address,stopOffset,stopReason,
  commands:Object.freeze(commands),readOnly:true,
  layoutAuthenticated:false,grammarAuthenticated:false,
  scriptLengthVerified:false,controlFlowFollowed:false,
  writeAuthorized:false});
}
