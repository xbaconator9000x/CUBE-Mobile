/**
 * Bounded, read-only vanilla map object, script-trigger and signpost records.
 * Source: kcradi/CUBHMA HexManiac.Core/Models/Map/MapModel.cs
 * Format.ObjectsFormat, ScriptsFormat, SignpostsFormat, EventsFormat.
 *
 * The caller MUST independently verify that the ROM uses vanilla RSE/FRLG
 * structures. This is not CUBE layout authentication, script interpretation,
 * collision editing, or a safe semantic writer.
 */
import {inspectVanillaMapHeader} from './map-layouts.js';

function eventAccessor(source){
  if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
  throw new TypeError('Expected ROM bytes or a read-only ROM accessor');
}
function eventSpan(rom,offset,size,label,align=4){
  if(!Number.isSafeInteger(offset)||offset<0||offset%align!==0||
     !Number.isSafeInteger(size)||size<0||offset>rom.length-size)
    throw new RangeError(label+' is unaligned or outside ROM bounds');
}
function eventU8(rom,offset){
  const value=rom.read(offset);
  if(!Number.isInteger(value)||value<0||value>255)throw new RangeError('Invalid ROM accessor byte');
  return value;
}
function eventU16(rom,offset){return eventU8(rom,offset)|(eventU8(rom,offset+1)<<8);}
function eventU32(rom,offset){return (eventU16(rom,offset)|(eventU16(rom,offset+2)<<16))>>>0;}
function eventIntersects(a,al,b,bl){return a<b+bl&&b<a+al;}
function eventPointer(rom,value,label){
  if(value<0x08000000||value>=0x0a000000)throw new RangeError(label+' is not a conventional GBA ROM eventPointer');
  const offset=value-0x08000000;
  eventSpan(rom,offset,4,label);
  return offset;
}
const eventDefinitions=Object.freeze([
  Object.freeze({name:'objects',countOffset:0,pointerOffset:4,size:24}),
  Object.freeze({name:'warps',countOffset:1,pointerOffset:8,size:8}),
  Object.freeze({name:'scripts',countOffset:2,pointerOffset:12,size:16}),
  Object.freeze({name:'signposts',countOffset:3,pointerOffset:16,size:12})
]);
/**
 * Validate all four arrays as a single non-overlapping structure before
 * returning any typed data. Zero-count pointers are ignored (may be garbage).
 * Script pointers and signpost args remain raw words: they are not followed.
 */
export function inspectVanillaMapEvents(source,{address,family}={}){
  const rom=eventAccessor(source);
  const header=inspectVanillaMapHeader(rom,{address,family});
  const empty=Object.freeze([]);
  if(header.eventsOffset===null)return Object.freeze({
    headerAddress:address,eventsOffset:null,counts:Object.freeze({objects:0,warps:0,scripts:0,signposts:0}),
    arrays:Object.freeze({objects:empty,warps:empty,scripts:empty,signposts:empty}),
    offsets:Object.freeze({objects:null,warps:null,scripts:null,signposts:null}),
    readOnly:true,layoutAuthenticated:false
  });
  const eventsOffset=header.eventsOffset;
  eventSpan(rom,eventsOffset,20,'Events group');
  const reserved=[
    {start:address,size:28,name:'map header'},
    {start:header.layoutOffset,size:family==='FRLG'?28:24,name:'map layout'},
    {start:header.layout.blockmapOffset,size:header.layout.byteLength,name:'blockmap'}
  ];
  for(const claim of reserved)if(eventIntersects(eventsOffset,20,claim.start,claim.size))
    throw new RangeError('Events group overlaps '+claim.name);
  const claims=[...reserved,{start:eventsOffset,size:20,name:'events group'}];
  const counts={},offsets={},arrays={};
  for(const def of eventDefinitions){
    const count=eventU8(rom,eventsOffset+def.countOffset);
    const raw=eventU32(rom,eventsOffset+def.pointerOffset);
    counts[def.name]=count;
    if(!count){offsets[def.name]=null;arrays[def.name]=empty;continue;}
    const offset=eventPointer(rom,raw,def.name+' array');
    const length=count*def.size;
    eventSpan(rom,offset,length,def.name+' array',def.name==='warps'?2:4);
    for(const claim of claims)if(eventIntersects(offset,length,claim.start,claim.size))
      throw new RangeError(def.name+' array overlaps '+claim.name);
    claims.push({start:offset,size:length,name:def.name+' array'});
    offsets[def.name]=offset;
    const records=[];
    for(let i=0;i<count;i++){
      const at=offset+i*def.size;
      let record;
      if(def.name==='objects')record={
        index:i,offset:at,id:eventU8(rom,at),graphics:eventU8(rom,at+1),
        familyField:eventU16(rom,at+2),x:eventU16(rom,at+4),y:eventU16(rom,at+6),
        elevation:eventU8(rom,at+8),movement:eventU8(rom,at+9),range:eventU16(rom,at+10),
        trainerType:eventU16(rom,at+12),trainerRangeOrBerryId:eventU16(rom,at+14),
        scriptPointer:eventU32(rom,at+16),flag:eventU16(rom,at+20),padding:eventU16(rom,at+22)
      };
      else if(def.name==='warps')record={
        index:i,offset:at,x:eventU16(rom,at),y:eventU16(rom,at+2),
        elevation:eventU8(rom,at+4),warpId:eventU8(rom,at+5),
        targetMap:eventU8(rom,at+6),targetBank:eventU8(rom,at+7)
      };
      else if(def.name==='scripts')record={
        index:i,offset:at,x:eventU16(rom,at),y:eventU16(rom,at+2),
        elevation:eventU16(rom,at+4),trigger:eventU16(rom,at+6),
        indexValue:eventU32(rom,at+8),scriptPointer:eventU32(rom,at+12)
      };
      else record={
        index:i,offset:at,x:eventU16(rom,at),y:eventU16(rom,at+2),
        elevation:eventU8(rom,at+4),kind:eventU8(rom,at+5),
        unused:eventU16(rom,at+6),rawArgument:eventU32(rom,at+8)
      };
      records.push(Object.freeze(record));
    }
    arrays[def.name]=Object.freeze(records);
  }
  return Object.freeze({headerAddress:address,eventsOffset,
    counts:Object.freeze(counts),offsets:Object.freeze(offsets),arrays:Object.freeze(arrays),
    readOnly:true,layoutAuthenticated:false});
}

/**
 * Report raw object/trigger script pointer fields without following code.
 * A conventional in-bounds GBA ROM address is NOT proof of executable script
 * ownership, a valid command stream, or CUBE compatibility.
 */
export function inspectVanillaEventScriptPointers(source,{address,family}={}){
 const rom=eventAccessor(source);
 const events=inspectVanillaMapEvents(rom,{address,family});
 const records=[];
 const counts={inRom:0,null:0,outsideRom:0,nonRom:0};
 for(const [kind,offsetInRecord] of [['objects',16],['scripts',12]]){
  for(const event of events.arrays[kind]){
   const raw=event.scriptPointer;
   let status,targetOffset=null;
   if(raw===0)status='null';
   else if(raw>=0x08000000&&raw<0x0a000000){
    const target=raw-0x08000000;
    if(target<rom.length){status='in-rom';targetOffset=target;}
    else status='outside-rom';
   }else status='non-rom';
   counts[status==='in-rom'?'inRom':status==='outside-rom'?'outsideRom':
    status==='non-rom'?'nonRom':'null']++;
   records.push(Object.freeze({kind,index:event.index,sourceOffset:event.offset+offsetInRecord,
    rawPointer:raw,status,targetOffset}));
  }
 }
 return Object.freeze({headerOffset:address,counts:Object.freeze(counts),
  records:Object.freeze(records),readOnly:true,layoutAuthenticated:false,
  scriptsDecoded:false});
}

/**
 * Preview a bounded prefix of raw bytes at one explicitly selected vanilla
 * object/trigger script pointer. This is NOT a script parser or length finder.
 * Upstream CUBHMA ScriptParser uses game-dependent command definitions; bytes
 * must never be treated as executable instructions without that grammar.
 */
export function previewVanillaEventScriptBytes(source,{
 address,family,kind,index,byteCount=32
}={}){
 const rom=eventAccessor(source);
 if(kind!=='objects'&&kind!=='scripts')
  throw new RangeError('Choose a vanilla object or trigger script record');
 if(!Number.isSafeInteger(index)||index<0||index>254)
  throw new RangeError('Script record index must be 0–254');
 if(!Number.isSafeInteger(byteCount)||byteCount<1||byteCount>64)
  throw new RangeError('Raw preview is limited to 1–64 bytes');
 const pointers=inspectVanillaEventScriptPointers(rom,{address,family});
 const record=pointers.records.find(x=>x.kind===kind&&x.index===index);
 if(!record)throw new RangeError('Script record not found in selected map');
 if(record.status!=='in-rom'||record.targetOffset===null)
  throw new RangeError('Selected script pointer has no in-ROM target');
 const available=Math.min(byteCount,rom.length-record.targetOffset);
 const bytes=[];
 for(let i=0;i<available;i++)bytes.push(eventU8(rom,record.targetOffset+i));
 return Object.freeze({
  kind,index,pointerSourceOffset:record.sourceOffset,
  rawPointer:record.rawPointer,targetOffset:record.targetOffset,
  requestedBytes:byteCount,readBytes:available,
  truncated:available<byteCount,bytes:Object.freeze(bytes),
  readOnly:true,scriptsDecoded:false,layoutAuthenticated:false
 });
}
