# Vanilla map object, script and signpost inspection — 27 October 2026

Upstream source: [kcradi/CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/master/src/HexManiac.Core/Models/Map/MapModel.cs), `Format.ObjectsFormat`, `Format.ScriptsFormat`, `Format.SignpostsFormat`, `Format.EventsFormat`.

## Implemented
- `src/map-events.js` reads all four vanilla event-array pointer/count pairs from an explicitly supplied vanilla RSE/FRLG map header. Object records are 24 bytes, warp records 8, script triggers 16, and signposts 12.
- Source ROM offsets, raw script pointer words, event coordinates, trainer fields, flags and raw signpost argument unions are preserved. No scripts are executed or followed, no ROM bytes are written.
- All nonempty event arrays are validated together against the map header, layout, blockmap, event-group header and each other before typed records are returned. Invalid pointers, misalignment, truncated arrays and overlaps fail closed; unused zero-count pointers are not dereferenced.
- Mobile and offline Blockmaps screens show raw objects, script triggers and signposts, with touch buttons to inspect their bytes in Hex. Existing warp inspector remains available separately.
- Synthetic tests verify both vanilla families, source provenance, byte immutability, staged edits, empty groups, bounds and cross-array collisions.

## Still unsafe / unsupported
- A valid GBA header, user-entered offset or TOML filename does **not** authenticate a CUBE ROM or its map layout. Explicit custom/expansion metadata blocks this vanilla decoder in the UI.
- Event script pointers are raw 32-bit words; signpost arguments are union fields. Neither is interpreted as a verified executable script, flag, variable or data pointer.
- No CUBE event-format variants, sprite graphics, rendered tiles, script disassembly, collision/walkability, safe event edits, pointer relocation, map ownership graph or emulator/device acceptance.
- No feature-parity percentage is inferred from passing synthetic tests. Continue toward authenticated map discovery and actual map rendering.


## Raw script pointer fields

The event screen can now separately list raw object/trigger script pointer fields, preserving the exact pointer field offset and original 32-bit value. Conventional in-ROM addresses can be opened in the hex viewer, but **no scripts are parsed, followed, executed or edited**. Zero, non-conventional and outside-ROM values are reported distinctly. Signpost arguments are deliberately excluded because their meaning depends on the signpost type. All results are invalidated on ROM/map changes and remain unverified for CUBE layouts.
