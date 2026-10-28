# Declared CUBHMA map-bank pointer table — read-only

Pinned upstream [MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs) uses `GetTableModel("data.maps.banks")`, then `GetSubTable("maps")`. The pinned upstream `cube_emerald.toml` declares a fixed outer `[maps<...>]34` table at `0x102D520`. This establishes **metadata-declared 34 pointer slots**, not 34 validated CUBE banks or playable maps.

`src/hma-map-bank-declared-table.js` extracts only a bounded outer fixed count, refuses dynamic/ambiguous formats and reads every raw 32-bit word through the staged ROM accessor. It classifies conventional GBA ROM pointer shapes, out-of-ROM targets, duplicates, misalignment and pointers back into the table. Duplicate targets are observations, not proof of corruption. The metadata provenance gate rejects conflicting declarations and malformed addresses. No bank lengths, map counts, custom layout semantics, allocations or write authority are inferred.

Synthetic and pinned-upstream metadata tests establish immutable bounded behavior; genuine CUBE ROM matching, emulator acceptance, Android hardware acceptance and safe semantic save/reopen remain outstanding. Strict parity credit: **zero**.
