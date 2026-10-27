# Explicit vanilla map-bank and warp inspection — 27 October 2026

Source: `kcradi/CUBHMA/src/HexManiac.Core/Models/Map/MapModel.cs`, `AllMapsModel`, `MapBankModel`, `MapModel`, `Format.EventsFormat`, `Format.WarpsFormat`. This is an **independent read-only subset**, not a port of upstream's complete model.

## Delivered
- `src/map-discovery.js`: follow one explicitly supplied bank pointer-table entry to one explicitly supplied map pointer, then resolve the vanilla map header/layout/blockmap using the existing bounded decoder.
- Require user-provided bank count and per-bank map count. No speculative sentinel scans, no inferred ROM addresses, no full 128 MiB snapshots. Preserve pointer source offsets, ROM offsets, map indices, and staged byte reads.
- Parse vanilla events group (4 count bytes + 4 pointers, 20 bytes) and warp records (8 bytes each: x/y u16, elevation, warp ID, target map, target bank). Read up to 255 records; retain raw coordinates/destination IDs and original offsets. Tap a warp to inspect its hex bytes.
- Reject bad conventional pointers, unaligned/out-of-ROM arrays, overlaps with map structures, and explicit custom/expansion metadata in the mobile workflow. Return immutable data. No ROM writes.
- Integrate explicit bank/map selection and warp list into mobile and offline builds; synthetic regression tests cover bounds, FRLG/RSE, overlap, staged edits, null/empty events and byte immutability.

## Not yet supported
- A **known and authenticated vanilla** bank-table address is required; ROM headers or TOML names alone do not establish one. CUBE custom/expansion map formats may differ, and this code refuses explicit custom layout declarations.
- Count fields are user-supplied; these are not trusted bank/map discovery. Unknown pointer ownership, aliases, nested formats and custom layouts remain unsafe.
- Warp destination identifiers are **not** resolved to authenticated map targets. No sprite/map rendering, walkability, collision edits, object/script/signpost interpretation, connection editing, map writes or repointing.
- No licensed authentic ROM fixtures, cross-editor roundtrip, emulator or Android hardware acceptance. Do not infer percentage feature parity from test count.

Next: parse source-grounded HMA `data.maps.banks` nested format/count grammar with authenticated metadata; inspect connections and event records, then render tiles and implement safe semantic edit transactions only after full ownership and fingerprint gates.
