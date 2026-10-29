# Interrupted local BPS Save As: safe stage-link recovery

**Scope:** explicit local recovery of an already-published ROM copy. This is not CUBE semantic write authorization or emulator acceptance.

`npm run rom:bps:recover -- --out /path/to/new.gba --expected-target-sha256 <exact-64-hex-digest>`

The normal `rom:bps:saveas` command privately stages a verified BPS target, atomically hard-links the stage into a new output pathname, reopens the output, and unlinks the stage. A process crash **after** publication but **before** stage cleanup may leave a redundant private stage hardlink next to the valid output.

This recovery command independently reopens and hashes the published output, scans only the exact generated `.<output-name>.cube-rom-stage-<24-hex>` names in its private directory, and removes the stage link **only** when it is the same inode as the published ROM, both have exactly two hardlinks, both contents match the exact target hash, and no ambiguous/foreign stage names exist. It then reopens the surviving output again and fsyncs its directory.

The operation never overwrites or deletes the output, never reads or changes the original source ROM or BPS patch, and does not print private paths, hashes or bytes. Repeating it after successful cleanup is read-only and reports `already-clean`.

**Fail-closed limits:** it refuses symlinked paths, group/world-writable output directories, unknown or multiple stages, extra hardlinks, changing files, wrong digests and missing output. A crash **before** publication leaves an orphan stage that cannot be proven to belong to an output inode; the tool deliberately leaves it untouched for manual review. There is no automatic destructive directory sweep. Same-owner concurrent pathname manipulation cannot be made completely race-free using portable Node filesystem calls; use a private directory and do not run recovery concurrently with another Save As.

Synthetic tests in `tests/local-bps-recovery.test.mjs` exercise success, repeatability, digest mismatch, symlinks, foreign inodes, ambiguous hardlinks, private-directory enforcement and CLI redaction. Real CUBE ROM, game-emulator and Android-device acceptance remain unavailable.
