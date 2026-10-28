# Four-kind atomic CUBE map edit rehearsal (29 October 2026)

This checkpoint extends the pinned CUBHMA `MapModel.cs` raw CUBE connection format (`[direction:: offset:: mapGroup. mapNum. unused:]`, 12 bytes) into the existing copy-only combined map transaction. A single bounded operation can now include up to 32 each of map-cell, warp, event-position, and raw connection proposals. A single connection-only proposal is valid.

## Safety and behavior

- All four kinds are independently previewed against the **same original ROM**. Every expected byte is validated before a private snapshot is changed.
- The combined planner rejects any byte claimed by more than one proposal, including cross-kind aliases. It never attempts to guess which record owns a shared byte.
- The isolated copy is re-decoded for all changed records; the **entire connection array** is compared with the original except for explicitly selected records, and map graphics/warp topology/event positions are checked by their existing validators.
- Changed-byte auditing now includes connection records and reports intersections with explicitly counted cross-bank map, event and connection claims. A clean bounded audit is **not** global pointer ownership.
- The touchscreen and generated offline editor include connection proposals in combined verification and ownership review. If warp and connection queues use different declared destination-bank counts, the combined action fails closed.
- Every rehearsal rolls back its private copy and verifies the original source remained unchanged. It exports no ROM, IPS/BPS patch or byte payload; no persistent save or write permission exists.

## Verification

`npm test` includes four-kind, connection-only, stale-record, cross-kind overlap, shared connection-array ownership and mobile/offline integration coverage. `npm run build:standalone` must leave the checked-in offline HTML unchanged. CI also checks repository safety, the engineering work breakdown and strict feature parity.

The fixture is synthetic and is **not** independent proof of compatibility with an authenticated CUBE Emerald ROM/TOML build. No copyrighted ROMs are stored. Full ROM identity, global ownership, save/reopen, emulator and Android-device acceptance remain unresolved; strict verified parity remains 0/30.

This checkpoint does not itself change the 286-unit engineering estimate. Proportional completion should be reassessed alongside other substantial source-grounded work, not inflated by the number of tests or commits.
