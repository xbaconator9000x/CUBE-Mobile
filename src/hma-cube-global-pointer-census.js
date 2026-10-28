import {previewHmaCubeCellBatch} from './hma-cube-cell-batch.js';
import {previewHmaCubeWarpBatch} from './hma-cube-warp-batch.js';
import {previewHmaCubeEventPositionBatch} from './hma-cube-event-batch.js';
import {previewHmaCubeConnectionBatch} from './hma-cube-connection-edit.js';
import {previewHmaCubeScriptRetargetBatch} from './hma-cube-script-retarget.js';
import {inspectHmaCubeMapEntry} from './hma-cube-map-discovery.js';
import {inspectHmaCubeMapEventWarps} from './hma-cube-map-events.js';
import {inspectHmaCubeMapConnections} from './hma-cube-map-connections.js';

/**
 * Conservative, read-only whole-ROM GBA pointer-candidate census.
 * It detects aligned and unaligned 32-bit words that could reference source-grounded
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
 * Scans every possible four-byte window, including unaligned script operands.
 * Reports aggregate counts only; raw matches never prove pointer ownership.
 */
export function auditHmaCubeGlobalPointerCandidates(source, ranges, {arrayAnchors=[]}={}) {
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
  // Array-start pointers may alias an edited *later* record without
  // pointing into that record. Keep these separately from record-span hits.
  if (!Array.isArray(arrayAnchors) || arrayAnchors.length > 32)
    throw new RangeError('Provide at most 32 decoded parent-array anchors');
  const anchorCanonical = new Set(), anchorAlternate = new Set();
  const uniqueAnchors = new Set();
  for (const offset of arrayAnchors) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= rom.length)
      throw new RangeError('Parent-array anchor outside bounded ROM');
    uniqueAnchors.add(offset);
    anchorCanonical.add(0x08000000 + offset);
    if (offset < 0x02000000) {
      anchorAlternate.add(0x0A000000 + offset);
      anchorAlternate.add(0x0C000000 + offset);
    }
  }
  let alignedAnchorCanonical = 0, alignedAnchorAlternate = 0;
  let unalignedAnchorCanonical = 0, unalignedAnchorAlternate = 0;
  let distinctAnchorSourceWords = 0, ambiguousAnchorWords = 0;
  let alignedWords = 0, canonicalHits = 0, alternateHits = 0;
  let ambiguousExpandedHits = 0, distinctHitWords = 0;
  let unalignedWords = 0, unalignedCanonicalHits = 0;
  let unalignedAlternateHits = 0, unalignedAmbiguousHits = 0;
  let unalignedDistinctHits = 0;
  // A rolling little-endian window reads each ROM byte once, instead of
  // performing four accessor reads for every overlapping candidate.
  // This includes unaligned script operands and record-field pointers.
  function checkedByte(at) {
    const value = rom.read(at);
    if (!Number.isInteger(value) || value < 0 || value > 255)
      throw new RangeError('ROM accessor returned invalid byte');
    return value;
  }
  let word = (checkedByte(0) | (checkedByte(1) << 8) |
    (checkedByte(2) << 16) | (checkedByte(3) << 24)) >>> 0;
  for (let at = 0; at <= rom.length - 4; at++) {
    const direct = canonical.has(word), mirror = alternate.has(word);
    const anchorDirect = anchorCanonical.has(word);
    const anchorMirror = anchorAlternate.has(word);
    if (anchorDirect || anchorMirror) distinctAnchorSourceWords++;
    if (anchorDirect && anchorMirror) ambiguousAnchorWords++;
    if (at % 4 === 0) {
      alignedWords++;
      if (anchorDirect) alignedAnchorCanonical++;
      if (anchorMirror) alignedAnchorAlternate++;
      if (direct) canonicalHits++;
      if (mirror) alternateHits++;
      if (direct && mirror) ambiguousExpandedHits++;
      if (direct || mirror) distinctHitWords++;
    } else {
      unalignedWords++;
      if (anchorDirect) unalignedAnchorCanonical++;
      if (anchorMirror) unalignedAnchorAlternate++;
      if (direct) unalignedCanonicalHits++;
      if (mirror) unalignedAlternateHits++;
      if (direct && mirror) unalignedAmbiguousHits++;
      if (direct || mirror) unalignedDistinctHits++;
    }
    if (at < rom.length - 4)
      word = ((word >>> 8) | (checkedByte(at + 4) << 24)) >>> 0;
  }
  return Object.freeze({
    scannedAlignedWords: alignedWords,
    scannedUnalignedWords: unalignedWords,
    decodedRecordRanges: ranges.length,
    decodedParentArrayAnchors: uniqueAnchors.size,
    alignedParentArrayCanonicalCandidates: alignedAnchorCanonical,
    alignedParentArrayAlternateCandidates: alignedAnchorAlternate,
    unalignedParentArrayCanonicalCandidates: unalignedAnchorCanonical,
    unalignedParentArrayAlternateCandidates: unalignedAnchorAlternate,
    distinctParentArrayCandidateSourceWords: distinctAnchorSourceWords,
    ambiguousExpandedParentArrayCandidates: ambiguousAnchorWords,
    distinctTargetBytes: canonical.size,
    canonicalPointerCandidates: canonicalHits,
    alternateWindowCandidates: alternateHits,
    ambiguousExpandedWindowCandidates: ambiguousExpandedHits,
    distinctCandidateSourceWords: distinctHitWords,
    unalignedCanonicalPointerCandidates: unalignedCanonicalHits,
    unalignedAlternateWindowCandidates: unalignedAlternateHits,
    unalignedAmbiguousExpandedWindowCandidates: unalignedAmbiguousHits,
    unalignedDistinctCandidateSourceWords: unalignedDistinctHits,
    allAlignedWordsScanned: true,
    unalignedPointersInspected: true,
    allByteWindowsScanned: true,
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
 const opts={bankIndex,mapIndex,mapCount},ranges=[],arrayAnchors=[];
 const eventKinds=new Set();
 if(cells.length){
  const plan=previewHmaCubeCellBatch(source,summary,{
   ...opts,changes:cells,banks,x,y,viewportWidth,viewportHeight
  });
  for(const r of plan.changes)ranges.push({start:r.byteOffset,length:2});
  arrayAnchors.push(inspectHmaCubeMapEntry(source,summary,opts).layout.blockmapOffset);
 }
 if(warps.length){
  const plan=previewHmaCubeWarpBatch(source,summary,{
   ...opts,changes:warps,targetBanks
  });
  for(const r of plan.changes)ranges.push({start:r.sourceOffset,length:8});
  eventKinds.add('warps');
 }
 if(events.length){
  const plan=previewHmaCubeEventPositionBatch(source,summary,{
   ...opts,changes:events
  });
  const widths={objects:24,scripts:16,signposts:12};
  for(const r of plan.changes){
   if(!widths[r.kind])throw new RangeError('Unsupported CUBE event record kind');
   ranges.push({start:r.sourceOffset,length:widths[r.kind]});
   eventKinds.add(r.kind);
  }
 }
 if(connections.length){
  const plan=previewHmaCubeConnectionBatch(source,summary,{
   ...opts,changes:connections,targetBanks
  });
  for(const r of plan.changes)ranges.push({start:r.sourceOffset,length:12});
  const arrayOffset=inspectHmaCubeMapConnections(source,summary,opts).arrayOffset;
  if(arrayOffset!==null)arrayAnchors.push(arrayOffset);
 }
 if(scripts.length){
  const plan=previewHmaCubeScriptRetargetBatch(source,summary,{
   ...opts,changes:scripts
  });
  for(const r of plan.changes){
   const back=r.kind==='objects'?16:r.kind==='scripts'?12:8;
   const width=r.kind==='objects'?24:r.kind==='scripts'?16:12;
   ranges.push({start:r.sourceOffset-back,length:width});
   eventKinds.add(r.kind);
  }
 }
 if(eventKinds.size){
  const inspected=inspectHmaCubeMapEventWarps(source,summary,opts);
  for(const kind of eventKinds){
   const at=inspected.offsets[kind];
   if(at!==null)arrayAnchors.push(at);
  }
 }
 return auditHmaCubeGlobalPointerCandidates(source,ranges,{arrayAnchors});
}
