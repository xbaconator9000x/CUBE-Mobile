/**
 * Read-only, explicitly located vanilla map-bank and warp inspection.
 * Source: kcradi/CUBHMA src/HexManiac.Core/Models/Map/MapModel.cs
 * AllMapsModel -> MapBankModel -> MapModel, Format.EventsFormat/WarpsFormat.
 *
 * A GBA header, a TOML filename, or a plausible pointer chain does NOT
 * authenticate CUBE/stock layout. The caller must independently establish
 * that these structures use vanilla formats. Never write ROM bytes here.
 */
import {inspectVanillaMapHeader} from './map-layouts.js';

function reader(source) {
  if(source instanceof Uint8Array) return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')
    return source;
  throw new TypeError('Expected read-only ROM accessor or Uint8Array');
}
function bounded(rom,address,size,label,alignment=4) {
  if(!Number.isSafeInteger(address)||address<0||address%alignment!==0||
     !Number.isSafeInteger(size)||size<0||address>rom.length-size)
    throw new RangeError(label+' is unaligned or outside ROM bounds');
}
function byte(rom,i) {
  const n=rom.read(i);
  if(!Number.isInteger(n)||n<0||n>255)throw new RangeError('Invalid ROM accessor byte');
  return n;
}
function word(rom,i) {return byte(rom,i)|(byte(rom,i+1)<<8);}
function dword(rom,i) {
  return (byte(rom,i)|(byte(rom,i+1)<<8)|(byte(rom,i+2)<<16)|(byte(rom,i+3)<<24))>>>0;
}
function ptr(rom,raw,label) {
  if(raw<0x08000000||raw>=0x0A000000)
    throw new RangeError(label+' is not a conventional GBA ROM pointer');
  const address=raw-0x08000000;
  bounded(rom,address,4,label);
  return address;
}
function count(n,label,max) {
  if(!Number.isSafeInteger(n)||n<1||n>max)
    throw new RangeError(label+' must be 1–'+max);
}
function index(n,label,limit) {
  if(!Number.isSafeInteger(n)||n<0||n>=limit)
    throw new RangeError(label+' must be inside declared table');
}
function overlaps(a,as,b,bs){return a<b+bs&&b<a+as;}

/**
 * Resolve ONE bank/map pair, not a heuristic ROM scan. Counts are supplied
 * by the user, not inferred from sentinel bytes or ROM headers.
 */
export function inspectVanillaMapBankEntry(source,{
  address,bankCount,bankIndex,mapCount,mapIndex,family
}={}) {
  const rom=reader(source);
  count(bankCount,'Bank count',256);
  count(mapCount,'Map count',1024);
  index(bankIndex,'Bank index',bankCount);
  index(mapIndex,'Map index',mapCount);
  bounded(rom,address,bankCount*4,'Bank pointer table');
  const bankPointerSource=address+bankIndex*4;
  const bankPointer=dword(rom,bankPointerSource);
  const bankOffset=ptr(rom,bankPointer,'Bank map-pointer array');
  bounded(rom,bankOffset,mapCount*4,'Bank map-pointer array');
  if(overlaps(address,bankCount*4,bankOffset,mapCount*4))
    throw new RangeError('Bank and map pointer arrays overlap');
  const mapPointerSource=bankOffset+mapIndex*4;
  const mapPointer=dword(rom,mapPointerSource);
  const mapHeaderOffset=ptr(rom,mapPointer,'Map header');
  if(overlaps(mapHeaderOffset,28,address,bankCount*4)||
     overlaps(mapHeaderOffset,28,bankOffset,mapCount*4))
    throw new RangeError('Map header overlaps bank pointer arrays');
  const header=inspectVanillaMapHeader(rom,{address:mapHeaderOffset,family});
  if(overlaps(header.layoutOffset,header.layout.family==='FRLG'?28:24,address,bankCount*4)||
     overlaps(header.layoutOffset,header.layout.family==='FRLG'?28:24,bankOffset,mapCount*4))
    throw new RangeError('Map layout overlaps bank pointer arrays');
  if(overlaps(header.layout.blockmapOffset,header.layout.byteLength,address,bankCount*4)||
     overlaps(header.layout.blockmapOffset,header.layout.byteLength,bankOffset,mapCount*4))
    throw new RangeError('Blockmap overlaps bank pointer arrays');
  return Object.freeze({
    address,bankCount,bankIndex,mapCount,mapIndex,bankPointerSource,
    bankPointer,bankOffset,mapPointerSource,mapPointer,mapHeaderOffset,header,
    readOnly:true,layoutAuthenticated:false
  });
}

/**
 * Vanilla events group: four count bytes then four 32-bit pointers;
 * warps are eight-byte records: x:u16 y:u16 elevation:u8 warpID:u8
 * map:u8 bank:u8. Coordinates are retained without passability inference.
 * A nonzero warp count requires a valid bounded warp array.
 */
export function inspectVanillaMapWarps(source,{address,family}={}) {
  const rom=reader(source);
  const header=inspectVanillaMapHeader(rom,{address,family});
  if(header.eventsOffset===null)
    return Object.freeze({headerAddress:address,eventsOffset:null,warpCount:0,
      warpOffset:null,warps:Object.freeze([]),readOnly:true,layoutAuthenticated:false});
  const eventsOffset=header.eventsOffset;
  bounded(rom,eventsOffset,20,'Vanilla events group');
  if(overlaps(eventsOffset,20,address,28)||
     overlaps(eventsOffset,20,header.layoutOffset,family==='FRLG'?28:24))
    throw new RangeError('Events group overlaps map header/layout');
  const objectCount=byte(rom,eventsOffset),warpCount=byte(rom,eventsOffset+1),
    scriptCount=byte(rom,eventsOffset+2),signpostCount=byte(rom,eventsOffset+3);
  const warpPointer=dword(rom,eventsOffset+8);
  let warpOffset=null;
  const warps=[];
  if(warpCount) {
    warpOffset=ptr(rom,warpPointer,'Warp array');
    bounded(rom,warpOffset,warpCount*8,'Warp array',2);
    if(overlaps(warpOffset,warpCount*8,eventsOffset,20)||
       overlaps(warpOffset,warpCount*8,address,28)||
       overlaps(warpOffset,warpCount*8,header.layoutOffset,family==='FRLG'?28:24)||
       overlaps(warpOffset,warpCount*8,header.layout.blockmapOffset,header.layout.byteLength))
      throw new RangeError('Warp array overlaps map structures');
    for(let i=0;i<warpCount;i++){
      const offset=warpOffset+i*8;
      warps.push(Object.freeze({index:i,offset,x:word(rom,offset),y:word(rom,offset+2),
        elevation:byte(rom,offset+4),warpId:byte(rom,offset+5),
        targetMap:byte(rom,offset+6),targetBank:byte(rom,offset+7)}));
    }
  }
  return Object.freeze({
    headerAddress:address,eventsOffset,objectCount,warpCount,scriptCount,signpostCount,
    warpPointer:warpCount?warpPointer:null,warpOffset,warps:Object.freeze(warps),
    readOnly:true,layoutAuthenticated:false
  });
}
