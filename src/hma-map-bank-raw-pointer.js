/**
 * Read-only, four-byte raw evidence at a TOML-declared map-bank anchor.
 * Conventional GBA ROM pointers are 0x08000000–0x09FFFFFF. This DOES NOT
 * decode CUBE bank tables, custom formats, map counts or pointer ownership.
 */
export function inspectHmaMapBankRawPointer(rom,summary){
  if(!rom||!Number.isSafeInteger(rom.length)||rom.length<0||
     typeof rom.read!=='function')throw new TypeError('Expected bounded staged ROM reader');
  if(!summary||!['custom-candidate','vanilla-marker'].includes(summary.status)||
     summary.uniqueDeclarationCount!==1||
     !Array.isArray(summary.declarations)||summary.declarations.length<1||
     !summary.declarations.every(d=>d.addressInBounds===true&&
       d.address===summary.declarations[0].address))
    throw new RangeError('Map-bank anchor is missing, conflicting or unauthenticated metadata');
  const address=summary.declarations[0].address;
  if(!Number.isSafeInteger(address)||address<0||address>rom.length-4)
    throw new RangeError('Map-bank anchor is outside the current ROM');
  let rawWord=0;
  for(let i=0;i<4;i++){
    const byte=rom.read(address+i);
    if(!Number.isInteger(byte)||byte<0||byte>255)
      throw new RangeError('Invalid staged ROM byte');
    rawWord=(rawWord+(byte*2**(8*i)))>>>0;
  }
  const conventional=rawWord>=0x08000000&&rawWord<0x0A000000;
  const candidate=conventional?rawWord-0x08000000:null;
  const inBounds=candidate!==null&&candidate<rom.length;
  return Object.freeze({
    status:inBounds?'in-rom-pointer':conventional?'out-of-rom-pointer':'not-conventional-pointer',
    sourceOffset:address,rawWord,
    targetOffset:inBounds?candidate:null,
    readOnly:true,romAuthenticated:false,cubeLayoutAuthenticated:false,
    writeAuthorized:false
  });
}
