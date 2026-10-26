import {scanPcsTerminator} from './pcs-default.js';
/**
 * Conservative, read-only fixed-width GBA text-byte inspector.
 * This deliberately does NOT claim to decode Pokemon's proprietary PCS
 * alphabet. It exposes raw bytes, escape-aware termination and printable ASCII hints
 * for manual inspection without mutating ROM data.
 */
export function inspectFixedTextBytes(bytes, start, length) {
  const read = bytes instanceof Uint8Array ? i => bytes[i] :
    typeof bytes?.read === 'function' ? i => bytes.read(i) : null;
  if (!read || !Number.isSafeInteger(bytes.length) ||
      !Number.isSafeInteger(start) || !Number.isSafeInteger(length) ||
      start < 0 || length < 1 || length > 1024 ||
      start > bytes.length || length > bytes.length - start)
    throw Error('Invalid or out-of-bounds text byte span');
  const raw = Array.from({length}, (_,i)=>read(start+i));
  if (raw.some(v=>!Number.isInteger(v)||v<0||v>255))
    throw Error('Invalid ROM byte');
  const {terminatorOffset:terminator,malformedEscape} = scanPcsTerminator(raw);
  const payload = terminator < 0 ? raw : raw.slice(0,terminator);
  return {
    start,length,
    hex: raw.map(v=>v.toString(16).toUpperCase().padStart(2,'0')).join(' '),
    terminated: terminator >= 0,
    terminatorOffset: terminator,
    malformedEscape,
    asciiHint: payload.map(v=>v>=32&&v<=126?String.fromCharCode(v):'.').join(''),
    // This is NOT decoded PCS; glyph mappings are ROM/game-specific.
    encoding: 'unknown-gba-text'
  };
}
