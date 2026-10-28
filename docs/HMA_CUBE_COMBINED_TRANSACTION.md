# Cross-kind CUBE map transaction rehearsal

`src/hma-cube-combined-transaction.js` combines independently preflighted CUBE Emerald map-cell changes, eight-byte warp records, and fixed-width object/trigger/signpost position edits into a **single isolated copy-only transaction**.

Each kind is validated against the **same original ROM snapshot** using the existing pinned CUBHMA source-grounded decoders. The combined planner rejects overlapping byte claims, stale originals, malformed raw fields, and out-of-bounds records. After staging the union of changes, it re-decodes edited event positions, warp topology, and rendered map pixels, verifies no unrelated bytes changed, reverses every byte, and compares the complete source snapshot.

The function accepts 1–32 proposals per kind, at least one nonempty kind, and a 1–64 MiB ROM. It returns only aggregate verification booleans and counts, **never a modified ROM or patch bytes**. A copy-only rehearsal is not a saved-file roundtrip.

## Next integration and acceptance gates

This module is a core transaction primitive and is **not yet exposed as a combined touchscreen control**. The separate mobile warp/event queues and map-cell queue remain copy-only. Future integration should coordinate their queue snapshots and show a single cross-kind review before any save-as capability.

Before semantic ROM writing is considered, independently establish exact CUBE ROM/TOML provenance, complete ownership across every bank and alias, transactional persistence and reopen, emulator behavior, Android hardware testing, and the six-evidence feature acceptance gate. Synthetic fixtures are internal correctness tests, not proof of authentic parity.
