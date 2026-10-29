import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVerifiedBpsDiff} from '../src/bps-export.js';
import {applyBps, crc32} from '../src/core.js';

const base = () => Uint8Array.from({length: 2048}, (_, i) => (i * 31 + 7) & 255);
const le32 = (b, at) => (b[at] | (b[at+1] << 8) | (b[at+2] << 16) | (b[at+3] << 24)) >>> 0;

test('BPS sparse raw edit roundtrip is exact, source-bound and preserves original', () => {
  const source = base(), original = source.slice();
  const edits = [[2047, 9], [11, 88], [12, 90], [0, 44], [500, 12]];
  const patch = buildVerifiedBpsDiff(source, edits);
  const expected = source.slice();
  for (const [at, val] of edits) expected[at] = val;
  assert.equal(String.fromCharCode(...patch.subarray(0,4)), 'BPS1');
  assert.deepEqual(applyBps(source, patch), expected);
  assert.deepEqual(source, original);
  assert.equal(le32(patch, patch.length - 12), crc32(source));
  assert.equal(le32(patch, patch.length - 8), crc32(expected));
  assert.equal(le32(patch, patch.length - 4), crc32(patch, 0, patch.length - 4));
  assert.ok(patch.length < source.length / 5, 'Sparse patch should not copy unchanged ROM');
});
test('BPS supports changes past the IPS 16 MiB address boundary', () => {
  const source = new Uint8Array(0x1000002);
  const patch = buildVerifiedBpsDiff(source, [[0x1000000, 0x7f]]);
  const target = applyBps(source, patch);
  assert.equal(target[0x1000000], 0x7f);
  assert.equal(target.length, source.length);
  assert.ok(patch.length < 128);
});
test('BPS rejects stale sources and tampered patches', () => {
  const source = base(), patch = buildVerifiedBpsDiff(source, [[5, 19]]);
  const wrong = source.slice(); wrong[200] ^= 1;
  assert.throws(() => applyBps(wrong, patch), /CRC/i);
  const damaged = patch.slice(); damaged[damaged.length - 13] ^= 1;
  assert.throws(() => applyBps(source, damaged), /CRC/i);
});
test('BPS rejects invalid, duplicate, empty and no-op edits', () => {
  const source = base();
  for (const edits of [[], [[1, 10], [1, 20]], [[-1, 3]],
    [[2048, 3]], [[2, -1]], [[2, 256]], [[2, 1.5]],
    [[2, source[2]]], Array.from({length: 65537}, () => [0, 1])])
    assert.throws(() => buildVerifiedBpsDiff(source, edits), RangeError);
  assert.throws(() => buildVerifiedBpsDiff(new Uint8Array(191), [[1, 3]]), RangeError);
});
test('BPS coalesces contiguous changed bytes and ignores valid no-op entries', () => {
  const source = base(), edits = new Map([[100, 4], [101, 5], [102, 6], [700, source[700]]]);
  const patch = buildVerifiedBpsDiff(source, edits);
  const expected = source.slice();
  expected.set([4,5,6], 100);
  assert.deepEqual(applyBps(source, patch), expected);
});

test('Node Buffer inputs never mutate source bytes while building BPS', () => {
  const source = Buffer.from(base()), before = Buffer.from(source);
  const patch = buildVerifiedBpsDiff(source, [[8, 77], [2047, 99]]);
  const expected = Uint8Array.from(before);
  expected[8] = 77; expected[2047] = 99;
  assert.deepEqual(applyBps(source, patch), expected);
  assert.deepEqual(source, before);
});
