/**
 * Read-only vanilla RSE/FRLG map blockset headers.
 * Source: kcradi/CUBHMA MapModel.cs Format.BlockDataFormat.
 * 24-byte header: compressed, secondary, padding, tileset, palette, blocks,
 * then attributes/animation (RSE) or animation/attributes (FRLG).
 * This does NOT authenticate CUBE-specific layouts or render metatiles.
 */
import {inspectVanillaMapHeader} from './map-layouts.js';
function blocksetReader(source){
  if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
  throw new TypeError('Expected read-only ROM accessor');
}
function blocksetSpan(rom,offset,size,label,align=4){
  if(!Number.isSafeInteger(offset)||offset<0||offset%align!==0||offset>rom.length-size)
    throw new RangeError(label+' outside ROM bounds or unaligned');
}
function blocksetU8(rom,offset){
  const n=rom.read(offset);
  if(!Number.isInteger(n)||n<0||n>255)throw new RangeError('Invalid ROM accessor byte');
  return n;
}
function blocksetU32(rom,offset){
  return (blocksetU8(rom,offset)|(blocksetU8(rom,offset+1)<<8)|
    (blocksetU8(rom,offset+2)<<16)|(blocksetU8(rom,offset+3)<<24))>>>0;
}
function blocksetPtr(rom,raw,label,{nullable=false,align=4,minBytes=1}={}){
  if(nullable&&(raw===0||raw===0xffffffff))return null;
  if(raw<0x08000000||raw>=0x0a000000)
    throw new RangeError(label+' is not a conventional GBA ROM pointer');
  const offset=raw-0x08000000;
  blocksetSpan(rom,offset,minBytes,label,align);
  return offset;
}
function blocksetOverlap(a,al,b,bl){return a<b+bl&&b<a+al;}
export function inspectVanillaMapBlocksets(source,{address,family}={}){
  const rom=blocksetReader(source),header=inspectVanillaMapHeader(rom,{address,family});
  const layout=header.layout;
  const locations=[['primary',layout.primaryOffset],['secondary',layout.secondaryOffset]];
  const claims=[{offset:address,size:28,name:'map header'},
    {offset:header.layoutOffset,size:family==='FRLG'?28:24,name:'map layout'},
    {offset:layout.blockmapOffset,size:layout.byteLength,name:'blockmap'}];
  const result={};
  for(const [name,offset] of locations){
    blocksetSpan(rom,offset,24,name+' blockset header');
    for(const claim of claims)if(blocksetOverlap(offset,24,claim.offset,claim.size))
      throw new RangeError(name+' blockset header overlaps '+claim.name);
    claims.push({offset,size:24,name:name+' blockset header'});
    const compressed=blocksetU8(rom,offset),secondary=blocksetU8(rom,offset+1);
    if(compressed>1||secondary>1)
      throw new RangeError(name+' blockset flags are not vanilla boolean bytes');
    const tilesetPointer=blocksetU32(rom,offset+4);
    const palettePointer=blocksetU32(rom,offset+8);
    const metatilePointer=blocksetU32(rom,offset+12);
    const attributesPointer=blocksetU32(rom,offset+(family==='FRLG'?20:16));
    const animationPointer=blocksetU32(rom,offset+(family==='FRLG'?16:20));
    result[name]=Object.freeze({
      headerOffset:offset,isCompressed:Boolean(compressed),isSecondary:Boolean(secondary),
      tilesetPointer,tilesetOffset:blocksetPtr(rom,tilesetPointer,name+' tileset',{minBytes:32}),
      palettePointer,paletteOffset:blocksetPtr(rom,palettePointer,name+' palette',{align:2,minBytes:32}),
      metatilePointer,metatileOffset:blocksetPtr(rom,metatilePointer,name+' metatiles',{align:2,minBytes:2}),
      attributesPointer,attributesOffset:blocksetPtr(rom,attributesPointer,name+' attributes',{align:2,minBytes:2}),
      animationPointer,animationOffset:blocksetPtr(rom,animationPointer,name+' animation',{nullable:true}),
      readOnly:true,layoutAuthenticated:false
    });
  }
  return Object.freeze({headerAddress:address,family,primary:result.primary,secondary:result.secondary,
    readOnly:true,layoutAuthenticated:false});
}
