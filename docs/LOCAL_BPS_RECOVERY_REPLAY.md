# Source-bound BPS crash recovery (optional)

The existing local BPS Save As recovery accepts a published ROM path and exact target SHA-256. It only removes a redundant private staging hardlink after reopening and verifying the published ROM; it never deletes or overwrites the destination.

For stronger independent evidence, supply **all three** additional options to the recovery CLI:

```sh
node scripts/local-bps-recovery.mjs \
  --out /private/output/saved.gba \
  --expected-target-sha256 TARGET_SHA256 \
  --rom /private/input/original.gba \
  --patch /private/input/change.bps \
  --expected-sha256 SOURCE_SHA256
```

This optional mode reopens the original ROM and BPS patch using stable, symlink-rejecting local reads, validates the source SHA-256, independently replays the BPS patch, and requires the complete resulting bytes to equal the published ROM before removing a staging hardlink. The source and patch are checked again around recovery. A wrong source digest, incompatible patch, changed input, missing input or aliased path fails closed and leaves the published ROM untouched.

Existing two-argument recovery remains supported. No source, patch, ROM bytes, hashes or local paths are printed. This is a local byte-level transaction check, **not** proof of a genuine CUBE build, semantic pointer ownership, Android hardware behavior or game-emulator compatibility.
