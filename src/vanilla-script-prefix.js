/**
 * Conservative read-only decoder for a SMALL vanilla RSE/FRLG event-script
 * command prefix. Source: pinned kcradi/CUBHMA
 * src/HexManiac.Core/Models/Code/scriptReference.txt and ScriptParser.cs.
 *
 * Only unambiguous fixed-width signatures and pinned vanilla trainerbattle
 * subtypes 00–08 are recognized.
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
  0x2b:['checkflag',['word']],0x2d:['checkdailyflags',[]],
  0x2e:['gettime',[]],0x2f:['sound',['word']],0x30:['waitsound',[]],
  0x31:['fanfare',['word']],0x32:['waitfanfare',[]],
  // Fixed-width vanilla commands cross-checked against the pinned
  // CUBHMA scriptReference.txt. Family-specific 0x2c and unknown
  // signatures remain unsupported; 0x5c is handled by subtype below.
  0x33:['playsong',['word','byte']],0x34:['savesong',['word']],
  0x35:['fadedefault',[]],0x36:['fadesong',['word']],
  0x37:['fadeout',['byte']],0x38:['fadein',['byte']],
  0x39:['warp',['byte','byte','byte','word','word']],
  0x3a:['warpmuted',['byte','byte','byte','word','word']],
  0x3b:['warpwalk',['byte','byte','byte','word','word']],
  0x3c:['warphole',['byte','byte']],
  0x3d:['warpteleport',['byte','byte','byte','word','word']],
  0x3e:['warp3',['byte','byte','byte','word','word']],
  0x3f:['setwarpplace',['byte','byte','byte','word','word']],
  0x40:['warp4',['byte','byte','byte','word','word']],
  0x41:['warp5',['byte','byte','byte','word','word']],
  0x42:['getplayerpos',['word','word']],0x43:['countpokemon',[]],
  0x44:['additem',['word','word']],0x45:['removeitem',['word','word']],
  0x46:['checkitemroom',['word','word']],0x47:['checkitem',['word','word']],
  0x48:['checkitemtype',['word']],0x49:['addpcitem',['word','word']],
  0x4a:['checkpcitem',['word','word']],
  0x4b:['adddecoration',['word']],0x4c:['removedecoration',['word']],
  0x4d:['checkdecoration',['word']],0x4e:['testdecoration',['word']],
  0x4f:['applymovement',['word','pointer']],
  0x50:['applymovement2',['word','pointer','byte','byte']],
  0x51:['waitmovement',['word']],
  0x52:['waitmovement2',['word','byte','byte']],
  0x53:['hidesprite',['word']],
  0x54:['hidesprite2',['word','byte','byte']],
  0x55:['showsprite',['word']],
  0x56:['showsprite2',['word','byte','byte']],
  0x57:['movesprite',['word','word','word']],
  0x58:['spritevisible',['word','byte','byte']],
  0x59:['spriteinvisible',['word','byte','byte']],
  0x5a:['faceplayer',[]],0x5b:['spriteface',['word','byte']],
  0x5d:['repeattrainerbattle',[]],0x5e:['endtrainerbattle',[]],
  0x5f:['endtrainerbattle2',[]],
  0x60:['checktrainerflag',['word']],
  0x61:['defeatedtrainer',['word']],0x62:['readytrainer',['word']],
  0x63:['movesprite2',['word','word','word']],
  0x64:['moveoffscreen',['word']],
  0x65:['spritebehave',['word','byte']],
  0x66:['waitmsg',[]],0x67:['preparemsg',['pointer']],
  0x68:['closeonkeypress',[]],0x69:['lockall',[]],
  0x6a:['lock',[]],0x6b:['releaseall',[]],0x6c:['release',[]],
  0x6d:['waitkeypress',[]],0x6e:['yesnobox',['byte','byte']]
});
// Pinned CUBHMA scriptReference.txt: trainerbattle (5C) is subtype-width
// dependent. Only shared vanilla subtypes 00–08 are safe to decode here.
// 09+ differ by game or extension and must stop without guessing.
const TRAINER_BATTLE_POINTER_COUNTS=Object.freeze({
  0:2,1:3,2:3,3:1,4:3,5:2,6:4,7:3,8:4
});
const VANILLA_TERMINALS=new Set([0x02,0x03,0x05,0x08,0x24,0x27,0x39,0x3a,0x3b,0x3c,0x3d]);
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
  let signature=VANILLA_COMMANDS[opcode];
  if(opcode===0x5c){
   if(limit-cursor<2){
    stopReason=cursor+2>rom.length?'rom-end':'truncated-command';
    stopOffset=cursor;break;
   }
   const subtype=readScriptByte(rom,cursor+1);
   const pointers=TRAINER_BATTLE_POINTER_COUNTS[subtype];
   if(pointers===undefined){
    stopReason='unsupported-trainerbattle';stopOffset=cursor;break;
   }
   signature=['trainerbattle',['byte','word','word',
    ...Array(pointers).fill('pointer')]];
  }
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
