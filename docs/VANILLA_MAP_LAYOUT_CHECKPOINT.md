# Read-only vanilla map structure checkpoint — 27 October 2026

Implemented `src/map-layouts.js` and a mobile Blockmaps workflow for **manually supplied vanilla-format map header or map layout offsets**. Source-grounded in `kcradi/CUBHMA/src/HexManiac.Core/Models/Map/MapModel.cs`, specifically `Format.LayoutFormat`, `Format.MapFormat`, and `LayoutModel.BlockMap`.

## Scope

- Vanilla Ruby/Sapphire/Emerald layout: 24 bytes, `width:: height:: borderblock<> blockmap<> blockdata1<> blockdata2<>`.
- Vanilla FireRed/LeafGreen layout: same fields plus border width, border height and two unused bytes (28 bytes).
- Vanilla map header: 28 bytes beginning with pointers to layout, events, map scripts and connections. The remaining header fields are deliberately **not** interpreted.
- Strict four-byte source alignment, conventional GBA pointer range, ROM bounds, 1024×1024 dimension cap, complete blockmap bounds and overlap checks. Reads current staged bytes without a full-ROM copy. All returned objects are immutable.
- The Blockmaps screen can resolve the blockmap offset and dimensions from a known vanilla header/layout, populate the existing read-only cell viewer and jump to the corresponding raw hex bytes.

## Safety and limitations

**Do not treat this as a CUBE layout parser or a verified map bank.** CUBHMA dynamically replaces vanilla map formats when expansion metadata describes a different structure. This decoder does not identify a ROM's map layout from its header, scan map banks, authenticate metadata, prove pointer ownership, infer walkability or edit map cells. The UI refuses vanilla parsing when imported metadata explicitly declares a custom/expansion layout; absence of such metadata is **not** proof of vanilla compatibility. Invalid conventional pointers fail closed, and expanded pointer schemes are unsupported.

The existing six-bit cell field remains raw collision/elevation metadata. There is no automatic collision mask or warps/event parsing.

## Next

Resolve map bank pointers and map layouts from independently authenticated TOML grammar, add cross-editor read-only map/warp/event previews, then validate ROM/metadata fingerprints and roundtrip tests before any semantic writes. Android hardware testing and true CUBE-specific layout fixtures remain required.
