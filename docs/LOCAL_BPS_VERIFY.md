# Local BPS reopen acceptance (read-only)

This command verifies an existing BPS1 patch against a **locally owned ROM** without exporting or modifying either file. It is useful after raw-edit patch export and before independent game-emulator testing. It is not semantic CUBE edit authorization, authenticated ROM provenance, or emulator acceptance.

Run with locally computed SHA-256 digests for the original ROM and the **expected fully patched target**:

```sh
npm run rom:bps:verify -- \
  --rom /local/owned.gba \
  --patch /local/exported.bps \
  --expected-sha256 EXACT_SOURCE_SHA256 \
  --expected-target-sha256 EXACT_TARGET_SHA256
```

The source and patch must be regular, non-symlinked stable local files. The command checks source SHA-256, BPS1 patch/source/target CRC32, bounded decoder replay, exact target SHA-256, and reopens both inputs to confirm preservation. It refuses no-op patches, corrupt patches, stale sources and mismatched expected targets. Source ROMs are capped at 64 MiB; patch inputs at 2 MiB; the existing BPS decoder caps target size at 64 MiB. It produces only aggregate counts and booleans, not paths, ROM bytes or hashes. A failure prints a fixed generic message.

For a new sparse patch, first use [local BPS diff export](LOCAL_BPS_DIFF.md). This verification is intentionally a separate step so independently produced BPS files can be checked too. Both SHA-256 values are **user-supplied expectations**, not an independent CUBE ROM build identity. A successful result does not prove map pointer ownership, script behavior, emulator compatibility, Android hardware operation or any strict feature-parity family.
