# CUBE collision-only and tile-only painting previews

The rendered CUBE map now offers three independent **queue paint modes**:

- Tile and raw high bits (existing behavior).
- Metatile only: preserve every selected cell's original raw high bits.
- Raw collision/elevation only: preserve each cell's individual metatile ID.

All three modes work with single-cell queueing, rectangle brushes and
four-neighbor flood fill. Flood matching can compare metatile IDs, complete
16-bit raw words, or just the six high bits. The latter is useful for
previewing changes to a contiguous elevation/collision region without
overwriting its varied artwork.

The existing atomic virtual batch preflight checks each original word and
re-renders the proposed result. It refuses stale bytes, duplicate changes,
out-of-viewport coordinates and fills larger than 32 cells. No actual ROM
writes, collision-rule interpretation, walkability claims, or authenticated
CUBE save/reopen are enabled. The selected painting mode is not retroactively
applied to existing queue entries.

See src/hma-cube-cell-batch.js and tests/hma-cube-flood-fill.test.mjs.
