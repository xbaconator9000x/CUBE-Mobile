# Local BPS diff export — source-bound, copy-only

This is an opt-in **raw byte patch** workflow, not CUBE map semantic save/reopen, independent ROM authentication, or permission to write to a ROM. It creates a new `.bps` file; the input ROM is never overwritten or changed. The resulting patch can be applied to a separately owned ROM copy by a compatible BPS tool. No ROM or copyrighted assets are stored in this repository.

## Run

Create a local UTF-8 JSON plan with exact source-byte expectations:

```json
{
  "edits": [
    {"offset": 256, "expected": 0, "value": 1},
    {"offset": 257, "expected": 255, "value": 2}
  ]
}
```

The numbers above are examples, **not valid edits for any particular ROM**. The `offset` is a decimal zero-based file offset, not a GBA bus pointer. `expected` must equal the existing byte in the ROM. Compute the full source SHA-256 locally and run:

```sh
npm run rom:bps:local -- \
  --rom /path/to/owned.gba \
  --expected-sha256 YOUR_EXACT_64_HEX_DIGEST \
  --plan /path/to/edits.json \
  --out /path/to/new-diff.bps
```

The output must **not already exist**. The command refuses symlink-traversing input/output paths, stale expected bytes, duplicate offsets, unsupported JSON fields and hash mismatches. It stages the BPS patch in a private file, reopens and verifies its bytes, then publishes using a no-overwrite hardlink. A failed publication removes only the inode it created. The report contains counts and boolean evidence only, not source paths, digests or ROM bytes.

## Format and verification

The encoder uses BPS1 SourceRead and TargetRead operations with source/target/patch CRC32 values and independent replay through the existing BPS decoder. It supports sparse raw edits beyond the IPS 16 MiB address limit. Maximum input ROM: 64 MiB; maximum edits: 65,536; maximum patch artifact: 2 MiB. The source is reread and SHA-256 checked before publication. The original bytes remain unchanged.

The BPS format and CRC expectations are source-grounded against `kcradi/CUBHMA` pinned at `3044393183e01af2ae1e907fb37e4a75eda6a8dc`, `src/HexManiac.Core/Models/Code/BpsPatch.cs`.

**Limitations:** A user-declared SHA-256 does not establish ROM provenance. A BPS diff is not an ownership-checked CUBE semantic edit, collision editor, full map exporter or verified game-emulator/hardware release. Never treat the existence of a patch or a successful replay as evidence of exclusive ROM pointer ownership.
