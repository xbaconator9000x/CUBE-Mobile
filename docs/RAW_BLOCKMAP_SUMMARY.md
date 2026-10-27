# Raw blockmap high-bit and tile summary

Pinned upstream: [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs) uses \`data & 0x3FF\` for the metatile and \`data >> 10\` for the raw six high bits.

\`summarizeBlockmapChunk\` is a bounded, read-only inspection of a **caller-supplied** blockmap ROM offset and dimensions. It validates the full declared map span, reads up to 4096 cells per call, returns exact source offsets, counts all 64 possible high-bit values and reports the eight most common tile IDs. A \`nextCell\` cursor supports mobile pagination. Staged read accessors are supported; ROM bytes are never written or copied in full.

**Not yet supported:** CUBE layout authentication, collision/passability interpretation, semantic edits, source ownership, emulator and Android hardware acceptance. A six-bit value is not a portable walkability flag. Synthetic tests do not establish feature-family parity.
