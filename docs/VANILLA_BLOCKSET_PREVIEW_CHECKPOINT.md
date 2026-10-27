# Vanilla blockset pointer inspection and raw tileset preview — 27 October 2026

Upstream source: [kcradi/CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/master/src/HexManiac.Core/Models/Map/MapModel.cs), `Format.BlockDataFormat`, `MiniBlocksetModel`.

## Delivered
- Read-only 24-byte RSE/FRLG primary and secondary blockset header decoder with source offsets, compression/secondary flags, raw tileset/palette/metatile/attribute/animation pointers. RSE and FRLG attribute/animation pointer ordering differs and is handled explicitly.
- Reject out-of-ROM pointers, malformed boolean flags, misaligned or truncated blockset headers, overlaps with header/layout/blockmap and overlaps between the two blockset headers.
- Mobile and standalone screens expose both blockset summaries and an explicit preview button that opens the existing 4bpp graphics viewer with the referenced tileset and first palette. This is a **raw tile sheet preview**, not a map renderer.
- Synthetic tests cover family-specific pointer order, immutable staged-byte reads, overlaps, bounds and mobile/offline wiring.

## Outstanding limitations
- User-supplied vanilla header and selected family are **not authenticated** against the ROM. Declared CUBE expansion/custom metadata blocks this workflow.
- No verified CUBE blockset variants, tile animations, metatile composition, palette banks, collision attributes, walking behaviour, layered rendering or semantic writes.
- Existing LZ graphics preview takes a ROM snapshot when decompressing; large-ROM mobile memory use still requires optimization and hardware tests.
- This does not establish 20% full CUBHMA/CUBE parity. Next: bounded no-snapshot LZ decode, source-grounded metatile/palette composition and genuine map rendering with test fixtures.
