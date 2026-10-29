# Interrupted local BPS Save As: safe stage-link recovery

**Scope:** explicit local recovery of an already-published ROM copy. This is not CUBE semantic write authorization or emulator acceptance.

`npm run rom:bps:recover -- --out /path/to/new.gba --expected-target-sha256 <exact-64-hex-digest>`

The normal `rom:bps:saveas` command privately stages a verified BPS target, atomically hard-links the stage into a new output pathname, reopens the output, and unlinks the stage. A process crash **after** publication but **before** stage cleanup may leave a redundant private stage hardlink next to the valid output.

This recovery command independently reopens and hashes the published output, scans only the exact generated `.<output-name>.cube-rom-stage-<24-hex>` names in its private directory, and removes the stage link **only** when it is the same inode as the published ROM, both have exactly two hardlinks, both contents match the exact target hash, and no ambiguous/foreign stage names exist. It then reopens the surviving output again and fsyncs its directory.

The operation never overwrites or deletes the output, never reads or changes the original source ROM or BPS patch, and does not print private paths, hashes or bytes. Repeating it after successful cleanup is read-only and reports `already-clean`.

**Fail-closed limits:** it refuses symlinked paths, group/world-writable output directories, unknown or multiple stages, extra hardlinks, changing files, wrong digests and missing output. A crash **before** publication leaves an orphan stage that cannot be proven to belong to an output inode; the tool deliberately leaves it untouched for manual review. There is no automatic destructive directory sweep. Same-owner concurrent pathname manipulation cannot be made completely race-free using portable Node filesystem calls; use a private directory and do not run recovery concurrently with another Save As.

Synthetic tests in `tests/local-bps-recovery.test.mjs` exercise success, repeatability, digest mismatch, symlinks, foreign inodes, ambiguous hardlinks, private-directory enforcement and CLI redaction. Real CUBE ROM, game-emulator and Android-device acceptance remain unavailable.

## Private-directory publication and fail-closed rollback

The **Save As** command now requires an owner-controlled destination directory with no group/world write permission, and rechecks the same directory inode before creating its private stage and before publishing. It refuses symlinked destination directories. This matches the recovery tool's private-directory requirement and prevents accidental use of shared writable directories for a two-link ROM transaction.

After the exact source/target SHA-256 and BPS CRC checks, publication uses a hardlink from the newly created stage to the previously absent destination. The stage and destination must still name the same expected regular-file inode with exactly two links. The directory is synced before and after stage removal. If a post-publication check fails, rollback removes only the proven two-link pair. If either pathname has been replaced, another hardlink appears, the directory changes, or the stage is missing, the operation **refuses destructive cleanup** and leaves the files for manual review. A failure after stage removal may leave a valid published output even though the command reports failure; verify the target digest and use the explicit recovery workflow rather than overwriting it.

These protections cannot eliminate same-owner concurrent filesystem races with portable Node calls. Run Save As and recovery in a private directory without concurrent writers. The checks do not authenticate a CUBE ROM, grant semantic write ownership, or establish game-emulator/device acceptance.
