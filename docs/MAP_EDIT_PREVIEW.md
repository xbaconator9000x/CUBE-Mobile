# Vanilla blockmap cell change preview (read-only)

Pinned upstream: [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs). A vanilla cell is one little-endian 16-bit word: `(collision << 10) | tile`; the six high bits are **not** a portable walkability boolean.

`previewVanillaBlockmapCellChange` resolves a supplied, independently verified vanilla map header, checks the complete blockmap bounds, accepts tile (0–1023) and/or raw collision (0–63), and reports exact before/after bytes and source offsets. Optional expected raw word rejects stale selections. An optional declared atlas reports shared blockmap ownership, and rejects mismatching map snapshots. The preview neither writes nor authorizes writes.

**Not implemented:** CUBE-specific layout authentication, ROM version trust, allocation/repointing, safe transactional writes, emulator or Android acceptance. A plausible pointer is not sufficient to enable structured editing. Keep parity score unchanged.
