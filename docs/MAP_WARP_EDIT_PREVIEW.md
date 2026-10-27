# Vanilla warp record byte preview

Pinned upstream: [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), eight-byte vanilla warp records (`x:u16, y:u16, elevation:u8, warpId:u8, map:u8, bank:u8`).

`previewVanillaWarpRecordChange` validates a manually supplied vanilla header, re-reads the event array, checks bounded field values, optional expected original bytes, and proposed in-map coordinates. It returns immutable before/after byte arrays and exact ROM offsets. 0xFF destination IDs remain raw and **do not** establish runtime behavior.

This is a planning primitive, not an editor: no ROM writes, no relocation, no verified ownership, no CUBE layout authentication, no Android/emulator acceptance and no parity credit. Next: mobile UI and a separately authenticated transaction/allocator before any semantic writes.
