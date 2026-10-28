# HMA map-bank second-hop raw target windows (read-only)

Pinned [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs) resolves a bank with `GetSubTable("maps")` and then a map with `GetSubTable("map")`. This is **not** permission to assume a stock layout, bank length, sentinel, or map count.

`inspectHmaDeclaredBankTargetWindows` starts from an unambiguous metadata-declared bank pointer table, samples at most 16 raw words per distinct aligned in-ROM target (8 by default), and reports pointer-shaped nested words without following them. It rejects out-of-ROM, overlapping, unaligned and truncated samples and deduplicates shared targets. Maximum distinct targets is bounded, and malformed accessors fail closed. All results are immutable; no bytes are written.

These are raw **candidate** target bytes, not authenticated CUBE maps. Authentic ROM/metadata identity, complete HMA DSL interpretation, safe save/reopen, emulator and Android hardware acceptance are still required. Strict parity credit remains zero.
