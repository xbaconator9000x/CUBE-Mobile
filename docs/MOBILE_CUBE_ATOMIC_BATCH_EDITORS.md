# CUBE atomic warp/event mobile editing (copy-only)

The mobile web app and generated offline HTML now expose two bounded transaction queues tied to the currently inspected custom CUBE Emerald map. This implements the touchscreen front-end for the pinned-source batch engines in `src/hma-cube-warp-batch.js` and `src/hma-cube-event-batch.js`.

## Workflow

Inspect a declared custom map and its event/warp arrays. Under **Atomic CUBE warp batch**, load a warp index, edit the six raw fields, declare 1–8 explicit bank:map counts (including the source bank), and queue the proposal. Repeat for up to 32 **distinct** indices. Preview re-decodes the complete combined topology; Verify applies the batch only to an isolated copy and checks complete rollback.

Under **Atomic CUBE event relocation**, choose object, script trigger or signpost and an index, load the original coordinates/elevation, edit only these fields and queue up to 32 distinct events. Combined preview reports co-located destination cells, preserves unknown record bytes and script pointers, and re-decodes every event array. Verify rehearses the batch in memory and rolls back.

Both queues revalidate the exact original event inspection and ROM bytes on each operation. Switching ROM, metadata or map invalidates the queue. Duplicate indices, stale records, malformed bank counts and out-of-map positions fail closed.

## Limits and acceptance

**No ROM is modified or exported by these controls.** Source-grounded synthetic tests establish internal decoder behavior and in-memory rollback only. This does **not** establish authentic CUBE ROM/TOML identity, exclusive byte ownership, persisted save/reopen, emulator reachability, or Android device acceptance. The six-evidence strict parity gate remains unmet. Next work: authenticated map/render fixtures, complete ownership census, then a separate explicit, transactional save-as design with real-ROM acceptance before enabling any semantic writes.
