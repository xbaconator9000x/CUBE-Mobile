# CUBE raw connection batch preview and rollback

`src/hma-cube-connection-edit.js` provides a bounded 1–32 record atomic
preview and **copy-only** rollback for the pinned CUBHMA Emerald connection
array. Each 12-byte record uses raw `direction` (u32),
`rawDisplacement` (u32), `targetBank` (u8), `targetMap` (u8)
and `unused` (u16). The displacement remains raw to avoid silently
changing its signed representation. The decoder's signed displacement is
available for inspection but not used to alter bytes.

Each proposal must supply exact expected fields and supported proposed fields.
The implementation rejects duplicates, stale sources, malformed values,
out-of-bounds offsets and partial re-decodes. A virtual overlay is compared
against the entire decoded array, including untouched records. The dry-run
copies the full bounded ROM, applies all records, re-decodes, checks every
unplanned byte, rolls back and verifies source immutability.

Optional explicit destination bank counts provide only a raw
`within-explicit-count` / `outside-explicit-count` diagnostic.
They do not establish a valid connection direction, travel offset,
destination landing point, engine-specific map rules or ROM authenticity.

**No persisted ROM file or patch bytes are exported.** Complete pointer
ownership, authenticated CUBE ROM/TOML identity, genuine save/reopen,
emulator behavior and Android device testing remain required before writing
is enabled. Synthetic tests are not independent compatibility acceptance.

Source: `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`,
`src/HexManiac.Core/Models/Map/MapModel.cs`,
`ConnectionsFormat`.
