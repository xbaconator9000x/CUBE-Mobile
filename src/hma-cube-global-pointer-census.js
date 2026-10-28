import {previewHmaCubeCellBatch} from './hma-cube-cell-batch.js';
import {previewHmaCubeWarpBatch} from './hma-cube-warp-batch.js';
import {previewHmaCubeEventPositionBatch} from './hma-cube-event-batch.js';
import {previewHmaCubeConnectionBatch} from './hma-cube-connection-edit.js';
import {previewHmaCubeScriptRetargetBatch} from './hma-cube-script-retarget.js';

/**
 * Conservative, read-only whole-ROM GBA pointer-candidate census.
 * It detects aligned 32-bit words that could reference source-grounded
 * records affected by a proposed CUBE transaction. Pointer-shaped data
 * are NOT a parsed alias graph or evidence of exclusive ownership.
 *
 * The 0x0A/0x0C ROM windows can mirror 0x08 on ordinary GBA hardware,
 * while expanded ROM layouts may interpret them differently. Count these
 * candidates separately and never treat a zero result as write approval.
 */
const LIMIT = 64 * 1024 * 1024;
const MAX_RANGES = 160;
const MAX_TARGET_BYTES = 4096;

function sourceReader(source) {
  if (source instanceof Uint8Array)
    return {length: source.length, read: i => source[i]};
  if (source && Number.isSafeInteger(source.length) &&
      typeof source.read === 'function') return source;
  throw new TypeError('Expected bounded read-only ROM bytes');
}

/**
 * Ranges are existing decoded record spans, not arbitrary guessed pointers.
 * Scans every 4-byte-aligned source word. Reports aggregate counts only.
 */
export function auditHmaCubeGlobalPointerCandidates(source, ranges) {
  const rom = sourceReader(source);
  if (!Number.isSafeInteger(rom.length) || rom.length < 4 || rom.length > LIMIT)
    throw new RangeError('Whole-ROM pointer census requires 4 bytes to 64 MiB');
  if (!Array.isArray(ranges) || ranges.length < 1 || ranges.length > MAX_RANGES)
    throw new RangeError('Provide 1–160 decoded record ranges');
  const canonical = new Set(), alternate = new Set();
  let targetBytes = 0;
  for (const range of ranges) {
    if (!range || !Number.isSafeInteger(range.start) ||
        !Number.isSafeInteger(range.length) || range.start < 0 ||
        range.length < 1 || range.length > 32 ||
        range.start > rom.length - range.length)
      throw new RangeError('Decoded record range outside bounded ROM');
    targetBytes += range.length;
    if (targetBytes > MAX_TARGET_BYTES)
      throw new RangeError('Pointer census target budget exceeded');
    for (let offset = range.start; offset < range.start + range.length; offset++) {
      canonical.add(0x08000000 + offset);
      if (offset < 0x02000000) {
        alternate.add(0x0A000000 + offset);
        alternate.add(0x0C000000 + offset);
      }
    }
  }
  let alignedWords = 0, canonicalHits = 0, alternateHits = 0;
  let ambiguousExpandedHits = 0, distinctHitWords = 0;
  for (let at = 0; at <= rom.length - 4; at += 4) {
    const a = rom.read(at), b = rom.read(at + 1),
      c = rom.read(at + 2), d = rom.read(at + 3);
    if (!Number.isInteger(a) || a < 0 || a > 255 ||
        !Number.isInteger(b) || b < 0 || b > 255 ||
        !Number.isInteger(c) || c < 0 || c > 255 ||
        !Number.isInteger(d) || d < 0 || d > 255)
      throw new RangeError('ROM accessor returned invalid byte');
    alignedWords++;
    const value = (a + b * 256 + c * 65536 + d * 16777216) >>> 0;
    const direct = canonical.has(value), mirror = alternate.has(value);
    if (direct) canonicalHits++;
    if (mirror) alternateHits++;
    if (direct && mirror) ambiguousExpandedHits++;
    if (direct || mirror) distinctHitWords++;
  }
  return Object.freeze({
    scannedAlignedWords: alignedWords,
    decodedRecordRanges: ranges.length,
    distinctTargetBytes: canonical.size,
    canonicalPointerCandidates: canonicalHits,
    alternateWindowCandidates: alternateHits,
    ambiguousExpandedWindowCandidates: ambiguousExpandedHits,
    distinctCandidateSourceWords: distinctHitWords,
    allAlignedWordsScanned: true,
    unalignedPointersInspected: false,
    candidateReferencesOnly: true,
    globalOwnershipProven: false,
    independentlyAuthenticated: false,
    writeAuthorized: false,
    readOnly: true
  });
}

/**
 * Local-only adapter: derive target ranges from the same source-grounded
 * five-kind preview records used by combined CUBE transaction verification.
 * Does not expose raw ranges to the local acceptance JSON report.
 */
export function auditHmaCubeGlobalEditPointerCandidates(source,summary,{
 bankIndex,mapIndex,mapCount,cells=[],warps=[],events=[],connections=[],scripts=[],
 banks,targetBanks,x=0,y=0,viewportWidth=10,viewportHeight=8
}={}){
 const opts={bankIndex,mapIndex,mapCount},ranges=[];
 if(cells.length){
  const plan=previewHmaCubeCellBatch(source,summary,{
   ...opts,changes:cells,banks,x,y,viewportWidth,viewportHeight
  });
  for(const r of plan.changes)ranges.push({start:r.byteOffset,length:2});
 }
 if(warps.length){
  const plan=previewHmaCubeWarpBatch(source,summary,{
   ...opts,changes:warps,targetBanks
  });
  for(const r of plan.changes)ranges.push({start:r.sourceOffset,length:8});
 }
 if(events.length){
  const plan=previewHmaCubeEventPositionBatch(source,summary,{
   ...opts,changes:events
  });
  const widths={objects:24,scripts:16,signposts:12};
  for(const r of plan.changes){
   if(!widths[r.kind])throw new RangeError('Unsupported CUBE event record kind');
   ranges.push({start:r.sourceOffset,length:widths[r.kind]});
  }
 }
 if(connections.length){
  const plan=previewHmaCubeConnectionBatch(source,summary,{
   ...opts,changes:connections,targetBanks
  });
  for(const r of plan.changes)ranges.push({start:r.sourceOffset,length:12});
 }
 if(scripts.length){
  const plan=previewHmaCubeScriptRetargetBatch(source,summary,{
   ...opts,changes:scripts
  });
  for(const r of plan.changes){
   const back=r.kind==='objects'?16:r.kind==='scripts'?12:8;
   const width=r.kind==='objects'?24:r.kind==='scripts'?16:12;
   ranges.push({start:r.sourceOffset-back,length:width});
  }
 }
 return auditHmaCubeGlobalPointerCandidates(source,ranges);
}
