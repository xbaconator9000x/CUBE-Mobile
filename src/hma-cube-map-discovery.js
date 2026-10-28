/**
 * Read-only, source-grounded CUBE Emerald map structure inspection.
 * Pinned: kcradi/CUBHMA 3044393183e01af2ae1e907fb37e4a75eda6a8dc,
 * MapModel.cs and QuickEditItems/cube_emerald.toml.
 * Nested map counts are dynamic: an explicit bounded count is mandatory.
 * Recognized metadata is not independent ROM/build authentication.
 */
import {inspectHmaDeclaredBankPointerTable} from './hma-map-bank-declared-table.js';

const T=String.fromCharCode(96);
const BLOCKDATA='[isCompressed. isSecondary. lightPalettes. customLightColor. tileset<'+T+'lzt4'+T+'> pal<'+T+'ucp4:0123456789ABCDEF'+T+'> blockset<> attributes<> animation<>]1';
const LAYOUT='[width:: height:: borderblock<[border:|h]4> blockmap<'+T+'blm'+T+'> blockdata1<'+BLOCKDATA+'> blockdata2<'+BLOCKDATA+'> isFrlg. borderWidth. borderHeight. unused.]1';
const HEADER_TAIL=' music:songnames layoutID:data.maps.layouts+1 regionSectionID.data.maps.names weather.weathertypes mapType.maptypes floorNumber.|z nightMusic:songnames flags.|t|allowBiking.|allowEscaping.|allowRunning.|showMapName.|writeSpecialVarIsEffect.|cave.|unused: battleType.mapbattlescenes]1';

function reader(source){
  if(source instanceof Uint8Array)return {length:source.length,read:i=>source[i]};
  if(source&&Number.isSafeInteger(source.length)&&source.length>=0&&typeof source.read==='function')return source;
  throw new TypeError('Expected ROM byte array or bounded staged reader');
}
function span(rom,offset,size,label,align=4){
  if(!Number.isSafeInteger(offset)||offset<0||offset%align!==0||
     !Number.isSafeInteger(size)||size<1||offset>rom.length-size)
    throw new RangeError(label+' is unaligned or outside ROM');
}
function u8(rom,i){
  const n=rom.read(i);
  if(!Number.isInteger(n)||n<0||n>255)throw new RangeError('Invalid staged ROM byte');
  return n;
}
function u16(rom,i){return u8(rom,i)|(u8(rom,i+1)<<8);}
function u32(rom,i){return (u16(rom,i)|(u16(rom,i+2)<<16))>>>0;}
function pointer(rom,raw,label,{nullable=false,align=4}={}){
  if(nullable&&(raw===0||raw===0xFFFFFFFF))return null;
  if(raw<0x08000000||raw>=0x0A000000)
    throw new RangeError(label+' is not a conventional GBA ROM pointer');
  const target=raw-0x08000000;
  span(rom,target,1,label,align);
  return target;
}
function overlaps(a,as,b,bs){return a<b+bs&&b<a+as;}
function disjoint(a,as,b,bs,label){
  if(a!==null&&b!==null&&overlaps(a,as,b,bs))
    throw new RangeError(label+' overlaps another map structure');
}
function checkFormat(summary){
  if(summary?.status!=='custom-candidate'||summary.uniqueDeclarationCount!==1)
    throw new RangeError('An unambiguous custom CUBE metadata declaration is required');
  const hierarchy=summary.hierarchy,sections=hierarchy?.sections;
  if(!hierarchy||!sections||sections.layout!==LAYOUT||
     typeof sections.events!=='string'||typeof sections.connections!=='string'||
     !sections.events.startsWith('[objectCount. warpCount. scriptCount. signpostCount.')||
     !sections.connections.startsWith('[count:: connections<'))
    throw new RangeError('Unsupported CUBE custom map layout declaration');
  const expected='[layout<'+sections.layout+'> events<'+sections.events+
    '> mapscripts<[type. pointer<>]!00> connections<'+sections.connections+'>'+HEADER_TAIL;
  if(hierarchy.mapFormat!==expected)
    throw new RangeError('Unsupported CUBE map header field order');
}
/**
 * Resolve one explicit bank/map into a 28-byte custom header and layout.
 * No inferred map counts, walkability, ROM authenticity or editing.
 */
export function inspectHmaCubeMapEntry(source,summary,{bankIndex,mapIndex,mapCount}={}){
  const rom=reader(source);
  checkFormat(summary);
  if(!Number.isSafeInteger(mapCount)||mapCount<1||mapCount>1024||
     !Number.isSafeInteger(mapIndex)||mapIndex<0||mapIndex>=mapCount)
    throw new RangeError('Explicit map count/index outside 1–1024 budget');
  const table=inspectHmaDeclaredBankPointerTable(rom,summary);
  if(!Number.isSafeInteger(bankIndex)||bankIndex<0||bankIndex>=table.declaredBankCount)
    throw new RangeError('Bank index outside metadata-declared table');
  const bank=table.rows[bankIndex];
  if(bank.targetOffset===null||bank.unaligned||bank.pointsInsideTable)
    throw new RangeError('Selected bank pointer is not a safe in-ROM target');
  const bankOffset=bank.targetOffset,bankBytes=mapCount*4;
  span(rom,bankOffset,bankBytes,'Explicit bank map pointer array');
  disjoint(bankOffset,bankBytes,table.anchorOffset,table.tableByteLength,'Bank pointer array');
  const mapPointerSource=bankOffset+mapIndex*4;
  const mapPointer=u32(rom,mapPointerSource);
  const headerOffset=pointer(rom,mapPointer,'CUBE map header');
  span(rom,headerOffset,28,'CUBE map header');
  disjoint(headerOffset,28,bankOffset,bankBytes,'Map header');
  disjoint(headerOffset,28,table.anchorOffset,table.tableByteLength,'Map header');
  const layoutPointer=u32(rom,headerOffset);
  const layoutOffset=pointer(rom,layoutPointer,'CUBE layout');
  span(rom,layoutOffset,28,'CUBE layout');
  disjoint(layoutOffset,28,headerOffset,28,'Map layout');
  disjoint(layoutOffset,28,bankOffset,bankBytes,'Map layout');
  disjoint(layoutOffset,28,table.anchorOffset,table.tableByteLength,'Map layout');
  const eventsPointer=u32(rom,headerOffset+4),scriptsPointer=u32(rom,headerOffset+8),
    connectionsPointer=u32(rom,headerOffset+12);
  const eventsOffset=pointer(rom,eventsPointer,'Events',{nullable:true});
  const scriptsOffset=pointer(rom,scriptsPointer,'Map scripts',{nullable:true});
  const connectionsOffset=pointer(rom,connectionsPointer,'Connections',{nullable:true});
  const width=u32(rom,layoutOffset),height=u32(rom,layoutOffset+4);
  if(width<1||height<1||width>1024||height>1024)
    throw new RangeError('CUBE layout dimensions outside bounded viewport');
  const borderPointer=u32(rom,layoutOffset+8),blockmapPointer=u32(rom,layoutOffset+12),
    primaryPointer=u32(rom,layoutOffset+16),secondaryPointer=u32(rom,layoutOffset+20);
  const borderOffset=pointer(rom,borderPointer,'Border blocks',{align:2});
  const blockmapOffset=pointer(rom,blockmapPointer,'Blockmap',{align:2});
  const primaryOffset=pointer(rom,primaryPointer,'Primary blockset');
  const secondaryOffset=pointer(rom,secondaryPointer,'Secondary blockset');
  const blockmapBytes=width*height*2;
  span(rom,blockmapOffset,blockmapBytes,'Complete CUBE blockmap',2);
  for(const [other,size,label] of [
    [table.anchorOffset,table.tableByteLength,'bank table'],
    [bankOffset,bankBytes,'bank map pointer array'],
    [headerOffset,28,'map header'],
    [layoutOffset,28,'map layout']])
    disjoint(blockmapOffset,blockmapBytes,other,size,'Blockmap versus '+label);
  const layout=Object.freeze({address:layoutOffset,width,height,blockmapOffset,
    blockmapPointer,blockmapBytes,borderOffset,borderPointer,primaryOffset,primaryPointer,
    secondaryOffset,secondaryPointer,isFrlg:u8(rom,layoutOffset+24),
    borderWidth:u8(rom,layoutOffset+25),borderHeight:u8(rom,layoutOffset+26),
    unused:u8(rom,layoutOffset+27)});
  const header=Object.freeze({address:headerOffset,layoutOffset,layoutPointer,
    eventsOffset,eventsPointer,scriptsOffset,scriptsPointer,
    connectionsOffset,connectionsPointer,music:u16(rom,headerOffset+16),
    layoutId:u16(rom,headerOffset+18),regionSectionId:u8(rom,headerOffset+20),
    weather:u8(rom,headerOffset+21),mapType:u8(rom,headerOffset+22),
    floorNumber:u8(rom,headerOffset+23),nightMusic:u16(rom,headerOffset+24),
    flags:u8(rom,headerOffset+26),battleType:u8(rom,headerOffset+27)});
  return Object.freeze({bankIndex,mapIndex,mapCount,declaredBankCount:table.declaredBankCount,
    bankPointerSource:bank.sourceOffset,bankOffset,mapPointerSource,mapPointer,
    header,layout,readOnly:true,metadataFormatRecognized:true,
    romAuthenticated:false,cubeLayoutAuthenticated:false,
    walkabilityVerified:false,writeAuthorized:false});
}
