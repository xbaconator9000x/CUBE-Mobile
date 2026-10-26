/**
 * Read-only Gen 3 PCS fallback decoder.
 * Ported independently from the fallback table/control lengths in
 * kcradi/CUBHMA src/HexManiac.Core/Models/PCSString.cs (MIT), pinned for
 * this checkpoint at blob 64c6512f2f052c5f4e202333af4acb406e2e3c05.
 * CUBHMA may load resources/pcsReference.txt and game-specific macros:
 * those overrides are NOT represented here. No encoding or ROM writes.
 */
const allowedGameCodes = new Set(['AXVE','AXPE','BPRE','BPGE','BPEE']);
const hexByte = value => value.toString(16).toUpperCase().padStart(2,'0');
const defaultPCS = (() => {
  const table = Array(256).fill(null);
  const chars = (start, value) => {
    Array.from(value).forEach((char, i) => { table[start+i] = char; });
  };
  const words = (start, value) => {
    value.split(' ').forEach((word, i) => { table[start+i] = word; });
  };
  table[0] = ' ';
  chars(0x01,'ÀÁÂÇÈÉÊËÌ');
  chars(0x0B,'ÎÏÒÓÔ');
  chars(0x10,'ŒÙÚÛÑßàá');
  chars(0x19,'çèéêëì');
  chars(0x20,'îïòóôœùúûñºª');
  table[0x2C] = '\\e';
  words(0x2D,'& \\+');
  words(0x34,'\\Lv = ;');
  table[0x48] = '\\r';
  words(0x51,'¿ ¡ \\pk \\mn \\Po \\Ke \\Bl \\Lo \\Ck Í');
  chars(0x5B,'%()');
  table[0x68] = 'â';
  table[0x6F] = 'í';
  words(0x79,'\\au \\ad \\al \\ar');
  table[0x84] = '\\d';
  words(0x85,'\\< \\>');
  chars(0xA1,'0123456789');
  words(0xAB,"! ? . - ‧ \\. \\qo \\qc ‘ ' \\sm \\sf $ , * /");
  chars(0xBB,'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  chars(0xD5,'abcdefghijklmnopqrstuvwxyz');
  chars(0xF0,':ÄÖÜäöü');
  table[0xF7] = '\\?';
  table[0xF8] = '\\btn';
  table[0xF9] = '\\9';
  table[0xFA] = '\\l';
  table[0xFB] = '\\pn';
  table[0xFC] = '\\CC';
  table[0xFD] = '\\\\';
  table[0xFE] = '\\n';
  return Object.freeze(table);
})();
const fixedControlLengths = Object.freeze({4:4,9:1,10:1,11:3,16:3});
function controlLength(code) {
  return fixedControlLengths[code] || (code > 0x14 ? 1 : 2);
}
function validateSpan(bytes,start,length) {
  const read = bytes instanceof Uint8Array ? i=>bytes[i] :
    typeof bytes?.read === 'function' ? i=>bytes.read(i) : null;
  if (!read || !Number.isSafeInteger(bytes.length) ||
      !Number.isSafeInteger(start) || !Number.isSafeInteger(length) ||
      start < 0 || length < 1 || length > 1024 ||
      start > bytes.length || length > bytes.length-start)
    throw Error('Invalid or out-of-bounds PCS span');
  const raw = Array.from({length},(_,i)=>read(start+i));
  if (raw.some(value=>!Number.isInteger(value)||value<0||value>255))
    throw Error('Invalid ROM byte');
  return raw;
}
/** FF inside a PCS control-code argument is data, not a terminator. */
export function scanPcsTerminator(raw) {
  if ((!Array.isArray(raw) && !(raw instanceof Uint8Array)) ||
      raw.length>1024) throw Error('Expected bounded byte array');
  // Validate even bytes consumed as escape arguments; never silently accept
  // malformed staged-reader data or sparse arrays.
  if (Array.from(raw).some(value=>!Number.isInteger(value)||value<0||value>255))
    throw Error('Invalid ROM byte');
  for (let i=0;i<raw.length;) {
    const value=raw[i];
    if (value===0xFF) return {terminatorOffset:i,malformedEscape:false};
    const extra=value===0xFC ?
      (i+1<raw.length ? controlLength(raw[i+1]) : 1) :
      ([0xF7,0xF8,0xF9,0xFD].includes(value) ? 1 : 0);
    if (extra && i+extra>=raw.length)
      return {terminatorOffset:-1,malformedEscape:true};
    i+=extra+1;
  }
  return {terminatorOffset:-1,malformedEscape:false};
}
/**
 * Decode only the upstream DEFAULT fallback mapping for recognised Gen 3
 * game codes. This is an unauthenticated preview, not PCS reference-file or
 * CUBE parity. Unknown bytes are escaped visibly rather than invented.
 */
export function decodeHmaPcsFallback(bytes,start,length,{gameCode}={}) {
  if (!allowedGameCodes.has(gameCode))
    return {supported:false,reason:'Unsupported or unverified game code; no PCS fallback assumed'};
  const raw=validateSpan(bytes,start,length);
  const tokens=[];
  let unknownByteCount=0,terminatorOffset=-1,truncatedEscape=false;
  for (let i=0;i<raw.length;) {
    const value=raw[i];
    if (value===0xFF) { terminatorOffset=i; break; }
    if ([0xF7,0xF8,0xF9,0xFD,0xFC].includes(value)) {
      const extra=value===0xFC ?
        (i+1<raw.length ? controlLength(raw[i+1]) : 1) : 1;
      const available=Math.min(extra,raw.length-i-1);
      tokens.push(defaultPCS[value]+raw.slice(i+1,i+1+available).map(hexByte).join(''));
      if (available!==extra) { truncatedEscape=true; break; }
      i+=extra+1;
      continue;
    }
    const glyph=defaultPCS[value];
    if (glyph===null) {
      unknownByteCount++;
      tokens.push('\\!'+hexByte(value));
    } else tokens.push(glyph);
    i++;
  }
  return {
    supported:true,
    text:tokens.join(''),
    terminated:terminatorOffset>=0,
    terminatorOffset,
    truncatedEscape,
    unknownByteCount,
    mapping:'upstream-default-gen3',
    authenticated:false,
    editable:false
  };
}
