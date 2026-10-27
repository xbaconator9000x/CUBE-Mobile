# Vanilla map connections — read-only checkpoint (27 October 2026)

The mobile Blockmaps screen can inspect the vanilla `connections` pointer in a manually supplied map header (or a header reached through an explicitly supplied bank/map table). The parser is grounded in `kcradi/CUBHMA/src/HexManiac.Core/Models/Map/MapModel.cs` `Format.ConnectionsFormat`: `[count:: connections<[direction:: offset:: mapGroup. mapNum. unused:]/count>]1`.

A connection header has a 32-bit count and a 32-bit pointer. Each record is 12 bytes: 32-bit direction, signed 32-bit displacement, target bank and map bytes, and a preserved unused 16-bit value. All records retain their source ROM offsets, and mobile users can tap to open raw hex. Parsing is bounded to 1024 records, checks pointer alignment, ROM bounds and overlapping known map structures, and reads staged edits without modifying ROM data.

This is **not** authenticated map topology, a rendered map, or an editor. Direction codes are displayed raw. No connection-target existence or geometry is inferred, no CUBE expansion structure is assumed, and no map/warp/collision writes are enabled. The UI refuses declared custom/expansion metadata; a vanilla-looking header alone does not authenticate its layout. Authentic licensed ROM, emulator, editor roundtrip and Android hardware validation remain outstanding.
