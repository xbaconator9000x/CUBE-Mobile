# Atomic CUBE warp-batch rehearsal

Pinned source: [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/HexManiac.Core/Models/MapModel.cs) (custom Emerald `WarpsFormat`: eight bytes per warp).

`src/hma-cube-warp-batch.js` extends the single-warp preflight to **1–32 distinct records** in a single declared source map. It checks every exact six-field original against the same unmodified source, rejects duplicate indices, invalid fields and coordinates, then overlays all records together. The combined warp table is decoded again and both full source-map topology audits are recomputed against explicit bank/map counts. This catches cases where changing two warps simultaneously changes each other's raw arrival evidence.

`verifyHmaCubeWarpBatchDryRun` copies a bounded 1–64 MiB ROM into isolated memory, checks snapshot stability, applies the full batch, re-decodes and audits the combined result, verifies the exact changed-byte set, reverses every changed record, and confirms the original source is unchanged. No output ROM or patch is exposed. Tests exercise simultaneous warp changes, rollback, duplicate proposals, stale originals, undeclared counts, invalid coordinates, unstable sources and oversized ROMs.

**Safety boundary:** a successful copy-only rehearsal is not a save/reopen test, does not prove exclusive ownership of all referenced bytes, does not authenticate the ROM/TOML pair, and does not validate emulator or Android behavior. This API explicitly sets `writeAuthorized: false`. Do not wire it to semantic ROM export until all independent compatibility and ownership gates are satisfied. The strict 30-family parity score is unchanged.
