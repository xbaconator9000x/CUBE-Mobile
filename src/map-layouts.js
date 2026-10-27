/**
 * Read-only, explicitly selected VANILLA RSE/FRLG map structures.
 *
 * Source: kcradi/CUBHMA src/HexManiac.Core/Models/Map/MapModel.cs
 * Format.LayoutFormat and Format.MapFormat (2026-10-27 inspection).
 * CUBHMA replaces these formats from metadata for expansion ROMs.
 * These functions NEVER infer a ROM's layout from its game code.
 */
function romReader(rom) {
  if (rom instanceof Uint8Array) return {length:rom.length,read:i=>rom[i]};
  if (rom && Number.isSafeInteger(rom.length) && rom.length>=0 && typeof rom.read==='function')
    return rom;
  throw new TypeError('Expected a ROM byte array or read-only accessor');
}
function requireSpan(rom,address,size,label) {
  if (!Number.isSafeInteger(address)||address<0||address%4!==0)
    throw new RangeError(label+' offset must be a four-byte-aligned ROM offset');
  if (address>rom.length-size) throw new RangeError(label+' extends beyond ROM bounds');
}
function u8(rom,i) {
  const n=rom.read(i);
  if (!Number.isInteger(n)||n<0||n>255) throw new RangeError('ROM accessor returned an invalid byte');
  return n;
}
function u32(rom,i) {
  return (u8(rom,i)|(u8(rom,i+1)<<8)|(u8(rom,i+2)<<16)|(u8(rom,i+3)<<24))>>>0;
}
function pointer(rom,raw,label,{nullable=false,alignment=4}={}) {
  if (nullable && (raw===0||raw===0xFFFFFFFF)) return null;
  // Only the conventional 32 MiB GBA ROM pointer window is understood.
  // Expanded CUBE layouts may use other conventions: never guess.
  if (raw<0x08000000||raw>=0x0A000000)
    throw new RangeError(label+' is not a conventional GBA ROM pointer');
  const offset=raw-0x08000000;
  if (offset%alignment!==0||offset>=rom.length)
    throw new RangeError(label+' points outside/alignment of ROM');
  return offset;
}
function familyCheck(family) {
  if (family!=='RSE'&&family!=='FRLG')
    throw new RangeError('Explicit vanilla family RSE or FRLG required');
}
/**
 * The vanilla RSE layout is 24 bytes: width:: height:: borderblock<>
 * blockmap<> blockdata1<> blockdata2<>.
 * FRLG appends borderwidth. borderheight. unused: (4 bytes).
 */
export function inspectVanillaMapLayout(source,{address,family}={}) {
  familyCheck(family);
  const rom=romReader(source),size=family==='FRLG'?28:24;
  requireSpan(rom,address,size,'Map layout');
  const width=u32(rom,address),height=u32(rom,address+4);
  if (!width||width>1024||!height||height>1024)
    throw new RangeError('Vanilla map dimensions are invalid or unsupported');
  const borderPointer=u32(rom,address+8),blockmapPointer=u32(rom,address+12);
  const primaryPointer=u32(rom,address+16),secondaryPointer=u32(rom,address+20);
  const borderOffset=pointer(rom,borderPointer,'Border block');
  const blockmapOffset=pointer(rom,blockmapPointer,'Blockmap',{alignment:2});
  const primaryOffset=pointer(rom,primaryPointer,'Primary blockset');
  const secondaryOffset=pointer(rom,secondaryPointer,'Secondary blockset');
  const byteLength=width*height*2;
  if (byteLength>rom.length-blockmapOffset)
    throw new RangeError('Complete vanilla blockmap extends beyond ROM');
  if (blockmapOffset<address+size && blockmapOffset+byteLength>address)
    throw new RangeError('Blockmap overlaps its layout header');
  const extra=family==='FRLG'?Object.freeze({
    borderWidth:u8(rom,address+24),borderHeight:u8(rom,address+25),
    unused:u8(rom,address+26)|(u8(rom,address+27)<<8)
  }):null;
  return Object.freeze({
    address,family,width,height,byteLength,blockmapOffset,blockmapPointer,
    borderOffset,borderPointer,primaryOffset,primaryPointer,
    secondaryOffset,secondaryPointer,extra,
    readOnly:true,layoutAuthenticated:false,walkabilityVerified:false
  });
}
/**
 * Vanilla map header begins with four pointers: layout, events, map scripts,
 * connections. This is not a map-bank scan and is NOT valid for unknown CUBE
 * expansion headers unless independently confirmed to use this exact format.
 */
export function inspectVanillaMapHeader(source,{address,family}={}) {
  familyCheck(family);
  const rom=romReader(source);
  requireSpan(rom,address,28,'Map header');
  const layoutPointer=u32(rom,address);
  const layoutOffset=pointer(rom,layoutPointer,'Layout');
  const eventsPointer=u32(rom,address+4),scriptsPointer=u32(rom,address+8),
    connectionsPointer=u32(rom,address+12);
  const eventsOffset=pointer(rom,eventsPointer,'Events',{nullable:true});
  const scriptsOffset=pointer(rom,scriptsPointer,'Map scripts',{nullable:true});
  const connectionsOffset=pointer(rom,connectionsPointer,'Connections',{nullable:true});
  if (layoutOffset<address+28 && layoutOffset+24>address)
    throw new RangeError('Layout overlaps map header');
  const layout=inspectVanillaMapLayout(rom,{address:layoutOffset,family});
  return Object.freeze({
    address,family,layoutPointer,layoutOffset,layout,
    eventsPointer,eventsOffset,scriptsPointer,scriptsOffset,
    connectionsPointer,connectionsOffset,
    readOnly:true,layoutAuthenticated:false
  });
}
