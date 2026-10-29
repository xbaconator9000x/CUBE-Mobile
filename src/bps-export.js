/**
 * Original BPS1 patch encoder for sparse, user-staged raw edits.
 * Source-grounded in the BPS format decoded by pinned CUBHMA BpsPatch.cs.
 * This is NOT CUBE semantic write authorization, and never writes a ROM.
 */
import {crc32, applyBps} from './core.js';

const MAX_ROM = 64 * 1024 * 1024;
const MAX_EDITS = 65536;
function number(out, value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid BPS number');
  while (true) {
    const low = value % 128;
    value = Math.floor(value / 128);
    if (!value) { out.push(low | 0x80); return; }
    out.push(low);
    value--;
  }
}
function uint32(out, value) {
  for (let i = 0; i < 4; i++) out.push((value >>> (8 * i)) & 255);
}
function checkedEdits(source, edits) {
  const pairs = edits instanceof Map ? [...edits] : edits;
  if (!Array.isArray(pairs) || !pairs.length || pairs.length > MAX_EDITS)
    throw new RangeError('BPS requires 1–65536 raw edit entries');
  const seen = new Set(), changed = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2 ||
        !Number.isSafeInteger(pair[0]) || pair[0] < 0 || pair[0] >= source.length ||
        !Number.isInteger(pair[1]) || pair[1] < 0 || pair[1] > 255 ||
        seen.has(pair[0]))
      throw new RangeError('Invalid, duplicate or out-of-ROM BPS edit');
    seen.add(pair[0]);
    if (source[pair[0]] !== pair[1]) changed.push(pair);
  }
  if (!changed.length) throw new RangeError('No changed bytes to export');
  changed.sort((a, b) => a[0] - b[0]);
  return changed;
}
/**
 * Generate a checksummed, source-bound BPS1 patch from sparse byte edits.
 * Uses only SourceRead and TargetRead; the patch contains changed bytes but
 * no unchanged ROM payload. It supports edits beyond IPS's 16 MiB limit.
 * An independent BPS decoder replays the patch before it is returned.
 */
export function buildVerifiedBpsDiff(source, edits) {
  if (!(source instanceof Uint8Array) ||
      source.length < 0xC0 || source.length > MAX_ROM)
    throw new RangeError('BPS source must be a 192-byte to 64 MiB ROM');
  const changes = checkedEdits(source, edits);
  // Buffer.slice() aliases its input; always copy, including Node Buffer inputs.
  const target = Uint8Array.from(source);
  for (const [at, value] of changes) target[at] = value;
  const out = [66, 80, 83, 49]; // BPS1
  number(out, source.length);
  number(out, target.length);
  number(out, 0); // no metadata, no identifying ROM information
  let cursor = 0, index = 0;
  while (cursor < source.length) {
    if (index < changes.length && changes[index][0] === cursor) {
      const start = cursor;
      while (index < changes.length && changes[index][0] === cursor) {
        cursor++; index++;
      }
      number(out, ((cursor - start - 1) * 4) + 1); // TargetRead
      for (let i = start; i < cursor; i++) out.push(target[i]);
    } else {
      const end = index < changes.length ? changes[index][0] : source.length;
      number(out, (end - cursor - 1) * 4); // SourceRead
      cursor = end;
    }
  }
  uint32(out, crc32(source));
  uint32(out, crc32(target));
  uint32(out, crc32(Uint8Array.from(out)));
  const patch = Uint8Array.from(out);
  const reopened = applyBps(source, patch);
  if (reopened.length !== target.length ||
      !reopened.every((byte, i) => byte === target[i]))
    throw new RangeError('BPS self-replay disagrees with staged changes');
  return patch;
}
