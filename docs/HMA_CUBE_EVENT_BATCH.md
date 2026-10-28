# Atomic multi-kind CUBE event repositioning

This copy-only workflow builds on [single-event position preflight](HMA_CUBE_EVENT_POSITION.md). `src/hma-cube-event-batch.js` atomically previews **1–32** distinct objects, script triggers and signposts from a single CUBE map. Every expected x/y/elevation is validated against the *same original source*, not an intermediate edit. The combined overlay is then re-decoded across all event arrays and unchanged records are compared exactly.

The resulting `colocatedDestinations` list identifies coordinates occupied by multiple records when at least one was moved. Overlap is a review hint, not an automatic error: some legitimate game scripts and warps share cells. `verifyHmaCubeEventPositionBatchDryRun` applies the entire batch to an isolated ROM copy, checks changed-byte boundaries, re-decodes and rolls back completely.

Pinned source: [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/HexManiac.Core/Models/MapModel.cs). This implementation never changes script pointers, flags or unknown event fields. It does not export a ROM, prove exclusive ownership, authenticate CUBE ROM/TOML metadata, or establish emulator/Android acceptance. The six-evidence strict parity gate remains unchanged.
