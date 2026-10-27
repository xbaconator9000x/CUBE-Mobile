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

function accessor(source){
  if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
  throw new TypeError('Expected ROM bytes or a read-only ROM accessor');
}
function span(rom,offset,size,label,align=4){
  if(!Number.isSafeInteger(offset)||offset<0||offset%align!==0||
     !Number.isSafeInteger(size)||size<0||offset>rom.length-size)
    throw new RangeError(label+' is unaligned or outside ROM bounds');
}
function u8(rom,offset){
  const value=rom.read(offset);
  if(!Number.isInteger(value)||value<0||value>255)throw new RangeError('Invalid ROM accessor byte');
  return value;
}
function u16(rom,offset){return u8(rom,offset)|(u8(rom,offset+1)<<8);}
function u32(rom,offset){return (u16(rom,offset)|(u16(rom,offset+2)<<16))>>>0;}
function intersects(a,al,b,bl){return a<b+bl&&b<a+al;}
function pointer(rom,value,label){
  if(value<0x08000000||value>=0x0a000000)throw new RangeError(label+' is not a conventional GBA ROM pointer');
  const offset=value-0x08000000;
  span(rom,offset,4,label);
  return offset;
}
const definitions=Object.freeze([
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
  const rom=accessor(source);
  const header=inspectVanillaMapHeader(rom,{address,family});
  const empty=Object.freeze([]);
  if(header.eventsOffset===null)return Object.freeze({
    headerAddress:address,eventsOffset:null,counts:Object.freeze({objects:0,warps:0,scripts:0,signposts:0}),
    arrays:Object.freeze({objects:empty,warps:empty,scripts:empty,signposts:empty}),
    offsets:Object.freeze({objects:null,warps:null,scripts:null,signposts:null}),
    readOnly:true,layoutAuthenticated:false
  });
  const eventsOffset=header.eventsOffset;
  span(rom,eventsOffset,20,'Events group');
  const reserved=[
    {start:address,size:28,name:'map header'},
    {start:header.layoutOffset,size:family==='FRLG'?28:24,name:'map layout'},
    {start:header.layout.blockmapOffset,size:header.layout.byteLength,name:'blockmap'}
  ];
  for(const claim of reserved)if(intersects(eventsOffset,20,claim.start,claim.size))
    throw new RangeError('Events group overlaps '+claim.name);
  const claims=[...reserved,{start:eventsOffset,size:20,name:'events group'}];
  const counts={},offsets={},arrays={};
  for(const def of definitions){
    const count=u8(rom,eventsOffset+def.countOffset);
    const raw=u32(rom,eventsOffset+def.pointerOffset);
    counts[def.name]=count;
    if(!count){offsets[def.name]=null;arrays[def.name]=empty;continue;}
    const offset=pointer(rom,raw,def.name+' array');
    const length=count*def.size;
    span(rom,offset,length,def.name+' array',def.name==='warps'?2:4);
    for(const claim of claims)if(intersects(offset,length,claim.start,claim.size))
      throw new RangeError(def.name+' array overlaps '+claim.name);
    claims.push({start:offset,size:length,name:def.name+' array'});
    offsets[def.name]=offset;
    const records=[];
    for(let i=0;i<count;i++){
      const at=offset+i*def.size;
      let record;
      if(def.name==='objects')record={
        index:i,offset:at,id:u8(rom,at),graphics:u8(rom,at+1),
        familyField:u16(rom,at+2),x:u16(rom,at+4),y:u16(rom,at+6),
        elevation:u8(rom,at+8),movement:u8(rom,at+9),range:u16(rom,at+10),
        trainerType:u16(rom,at+12),trainerRangeOrBerryId:u16(rom,at+14),
        scriptPointer:u32(rom,at+16),flag:u16(rom,at+20),padding:u16(rom,at+22)
      };
      else if(def.name==='warps')record={
        index:i,offset:at,x:u16(rom,at),y:u16(rom,at+2),
        elevation:u8(rom,at+4),warpId:u8(rom,at+5),
        targetMap:u8(rom,at+6),targetBank:u8(rom,at+7)
      };
      else if(def.name==='scripts')record={
        index:i,offset:at,x:u16(rom,at),y:u16(rom,at+2),
        elevation:u16(rom,at+4),trigger:u16(rom,at+6),
        indexValue:u32(rom,at+8),scriptPointer:u32(rom,at+12)
      };
      else record={
        index:i,offset:at,x:u16(rom,at),y:u16(rom,at+2),
        elevation:u8(rom,at+4),kind:u8(rom,at+5),
        unused:u16(rom,at+6),rawArgument:u32(rom,at+8)
      };
      records.push(Object.freeze(record));
    }
    arrays[def.name]=Object.freeze(records);
  }
  return Object.freeze({headerAddress:address,eventsOffset,
    counts:Object.freeze(counts),offsets:Object.freeze(offsets),arrays:Object.freeze(arrays),
    readOnly:true,layoutAuthenticated:false});
}
