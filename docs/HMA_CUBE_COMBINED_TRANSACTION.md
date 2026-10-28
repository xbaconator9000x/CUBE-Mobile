# Cross-kind CUBE map transaction rehearsal

`src/hma-cube-combined-transaction.js` combines independently preflighted CUBE Emerald map-cell changes, eight-byte warp records, and fixed-width object/trigger/signpost position edits into a **single isolated copy-only transaction**.

Each kind is validated against the **same original ROM snapshot** using the existing pinned CUBHMA source-grounded decoders. The combined planner rejects overlapping byte claims, stale originals, malformed raw fields, and out-of-bounds records. After staging the union of changes, it re-decodes edited event positions, warp topology, and rendered map pixels, verifies no unrelated bytes changed, reverses every byte, and compares the complete source snapshot.

The function accepts 1–32 proposals per kind, at least one nonempty kind, and a 1–64 MiB ROM. It returns only aggregate verification booleans and counts, **never a modified ROM or patch bytes**. A copy-only rehearsal is not a saved-file roundtrip.

## Next integration and acceptance gates

The mobile and offline UI now expose **Verify combined cell, warp and event rollback**. It combines the current map-cell queue (when its rendered snapshot matches the inspected CUBE map) with the warp and event queues, rejecting stale or mismatched map/ROM selections. At least one warp or event must be queued to enable this action. It remains copy-only; a persisted save-as workflow is not enabled.

Before semantic ROM writing is considered, independently establish exact CUBE ROM/TOML provenance, complete ownership across every bank and alias, transactional persistence and reopen, emulator behavior, Android hardware testing, and the six-evidence feature acceptance gate. Synthetic fixtures are internal correctness tests, not proof of authentic parity.
