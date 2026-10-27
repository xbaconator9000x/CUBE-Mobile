# Vanilla declared-atlas raw-cell census

`auditVanillaAtlasRawCells(source, atlas, options)` performs a bounded, **read-only** census of the high six bits of vanilla RSE/FRLG blockmap words, following the pinned CUBHMA `MapModel.BlockCells` encoding (`word & 0x3ff`, `word >> 10`). These are **raw collision/elevation bytes**, not a validated passability rule.

The caller must first create a declared atlas with `inspectVanillaMapAtlas`, supplying an independently established bank-table ROM offset, map counts and vanilla family. The census independently re-reads every canonical map pointer and layout. It fails closed if any declaration has changed, if a different blockmap partially overlaps another, or if its map/cell budgets are exceeded. Exact shared blockmaps are counted once physically and also counted per logical map reference.

Defaults: up to 256 maps, 131,072 unique cells, 64 displayed map summaries, and 4,096 cells per chunk. `rawHighBitCounts[0..63]` and `nonzeroRawHighBitCells` describe **raw values only**; nonzero does not mean impassable. `rowsTruncated` means the optional per-map display is shortened, not that aggregate coverage is partial. Caller-supplied staged read-only accessors are supported. No ROM bytes are exported or written.

This is synthetic-test evidence only. It does not authenticate CUBE-specific map structures, verify collision semantics, prove shared allocation ownership, test emulator behavior or grant strict mobile parity credit.
