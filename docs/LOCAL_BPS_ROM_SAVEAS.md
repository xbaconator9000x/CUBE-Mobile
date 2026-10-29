# Local verified BPS target ROM Save As

This is an **opt-in, local-only raw BPS application workflow** for a ROM you own. It creates a **new** target ROM file without overwriting or modifying the original. It is **not** an authenticated CUBE semantic edit, a substitute for complete pointer ownership, or strict feature-parity acceptance.

Run after obtaining a BPS patch and independently calculating both expected SHA-256 values:

```sh
npm run rom:bps:saveas --   --rom /local/owned.gba   --patch /local/change.bps   --out /local/new-copy.gba   --expected-sha256 SOURCE_SHA256   --expected-target-sha256 TARGET_SHA256
```

The caller must explicitly provide the expected **target** digest from an independent trusted expectation; the program never treats a digest it just computed as independent evidence. A successful run verifies the exact source hash, independently replays the BPS1 patch with its source, target and patch CRC32 checks, matches the full target SHA-256, and reopens both original inputs.

The target is written to a randomly named private staging file in the output directory, synced and independently reopened, then published using an exclusive hard link. The program reopens the published inode, compares the entire target, rechecks the unchanged original ROM and patch, syncs the destination directory, and removes its private staging link. An existing output file, symlink, hardlink or directory symlink is never overwritten. A failed post-publication verification attempts to remove **only** the destination inode created by this invocation. Inputs are bounded (ROM 64 MiB; patch 2 MiB) and symlink traversal is refused.

**Limitations:** This is a filesystem-level Save As, not crash-consistent multi-file transaction journaling across arbitrary filesystems, and does not eliminate all malicious concurrent filesystem races. BPS output may be valid as a patch while incompatible with the game engine. No authentic CUBE ROM/TOML matching, full pointer ownership, semantic save/reopen, game-emulator execution or physical Android-device acceptance is claimed. Never commit ROMs, patches containing proprietary data, local paths, hashes, secrets or device records to this public repository. The CLI prints only aggregate status, sizes and explicit non-acceptance flags.

This builds on the verified BPS exporter and local read-only acceptance tools; it does not enable automatic CUBE map/event/script writing in the mobile UI.
