/**
 * Read-only vanilla map connections (NOT CUBE expansion layout).
 * kcradi/CUBHMA MapModel.cs Format.ConnectionsFormat:
 * [count:: connections<[direction:: offset:: mapGroup. mapNum. unused:]/count>]1
 *
 * A header/metadata label does not authenticate the ROM's structure.
 */
import {inspectVanillaMapHeader} from './map-layouts.js';
function romReader(source){
  if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
  throw new TypeError('Expected a read-only ROM accessor');
}
function span(rom,offset,length,label){
  if(!Number.isSafeInteger(offset)||offset<0||offset%4||
    !Number.isSafeInteger(length)||length<0||offset>rom.length-length)
    throw new RangeError(label+' is unaligned or beyond ROM bounds');
}
function u8(rom,i){
  const n=rom.read(i);
  if(!Number.isInteger(n)||n<0||n>255)throw new RangeError('Invalid ROM byte');
  return n;
}
function u32(rom,i){
  return (u8(rom,i)|(u8(rom,i+1)<<8)|(u8(rom,i+2)<<16)|(u8(rom,i+3)<<24))>>>0;
}
function intersects(a,al,b,bl){return a<b+bl&&b<a+al;}
export function inspectVanillaMapConnections(source,{address,family}={}){
  const rom=romReader(source);
  const header=inspectVanillaMapHeader(rom,{address,family});
  if(header.connectionsOffset===null)
    return Object.freeze({headerAddress:address,connectionsOffset:null,count:0,
      arrayOffset:null,connections:Object.freeze([]),readOnly:true,layoutAuthenticated:false});
  const connectionsOffset=header.connectionsOffset;
  span(rom,connectionsOffset,8,'Connection header');
  const count=u32(rom,connectionsOffset);
  if(count>1024)throw new RangeError('Connection count exceeds read-only inspection cap');
  if(intersects(connectionsOffset,8,address,28)||
     intersects(connectionsOffset,8,header.layoutOffset,family==='FRLG'?28:24))
    throw new RangeError('Connection header overlaps map header/layout');
  const pointer=u32(rom,connectionsOffset+4);
  let arrayOffset=null;
  const connections=[];
  if(count){
    if(pointer<0x08000000||pointer>=0x0a000000)
      throw new RangeError('Connection array is not a conventional GBA pointer');
    arrayOffset=pointer-0x08000000;
    span(rom,arrayOffset,count*12,'Connection array');
    if(intersects(arrayOffset,count*12,connectionsOffset,8)||
       intersects(arrayOffset,count*12,address,28)||
       intersects(arrayOffset,count*12,header.layoutOffset,family==='FRLG'?28:24)||
       intersects(arrayOffset,count*12,header.layout.blockmapOffset,header.layout.byteLength))
      throw new RangeError('Connection array overlaps map structures');
    for(let i=0;i<count;i++){
      const offset=arrayOffset+i*12;
      const rawOffset=u32(rom,offset+4);
      connections.push(Object.freeze({
        index:i,offset,direction:u32(rom,offset),
        displacement:rawOffset|0,rawDisplacement:rawOffset,
        targetBank:u8(rom,offset+8),targetMap:u8(rom,offset+9),
        unused:u8(rom,offset+10)|(u8(rom,offset+11)<<8)
      }));
    }
  }
  return Object.freeze({
    headerAddress:address,connectionsOffset,count,pointer:count?pointer:null,
    arrayOffset,connections:Object.freeze(connections),
    readOnly:true,layoutAuthenticated:false
  });
}
