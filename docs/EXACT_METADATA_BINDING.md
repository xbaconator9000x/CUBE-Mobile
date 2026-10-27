# Exact TOML metadata SHA-256 binding — 27 October 2026

This checkpoint adds a **read-only identity primitive**, not an editor or a verified CUBE ROM registry. Source: `src/metadata-fingerprint.js`, with regression tests in `tests/metadata-fingerprint.test.mjs`.

## Implemented

- `fingerprintMetadataFiles([{name,bytes}])` hashes the exact supplied `Uint8Array` for each file using the same tested streaming SHA-256 implementation as ROM fingerprinting. Line endings, BOMs, binary bytes and trailing whitespace remain significant. No ROM bytes or metadata buffers are modified.
- `compareRomMetadataIdentity(model,romFingerprint,files,{profiles})` first validates the ROM SHA-256, size and header through `compareRomIdentity`, then compares the SHA-256 of **one exact metadata file** to that profile's `metadataSha256`.
- A missing, stale, unknown or header-conflicting ROM never receives a metadata match. Missing metadata and multi-file imports return distinct non-match states.
- Files are bounded to 4 MiB each, 16 MiB total and 16 files, with duplicate names rejected. Matching a caller-injected profile does **not** establish provenance.
- `metadataExactMatch` means **bytes equal the profile's declared digest**, nothing more. `metadataAuthenticated` and `semanticWritesAllowed` remain **false** in every case.

## Explicit limitations

The mobile named-data UI and checked-in standalone HTML now hash `File.arrayBuffer()` / `Response.arrayBuffer()` **before** decoding TOML with strict UTF-8, display each exact SHA-256, and commit cached fingerprints only after metadata parsing and collision checks succeed. The new `compareRomMetadataFingerprintRecords` API compares cached digest records without retaining raw TOML bytes. ROM replacement and metadata reset clear fingerprints; asynchronous imports fail closed when ROM bytes change or another import supersedes them. Fingerprint statuses update after ROM hashing and staged edits. These are **identity checks only**: the curated CUBE registry remains empty, imported TOML is not authenticated and semantic writes remain disabled.

Upstream CUBHMA's stock metadata can be composed from several TOML files (for example, a common default and a game-specific overlay). A profile's present singular `metadataSha256` cannot authenticate that set. **Do not concatenate decoded files** or treat the hash of just one overlay as sufficient. Future verified profiles need an ordered, source-pinned, exact-file manifest with unambiguous filenames, bytes, hashes and conflict rules.

No independently verified CUBE build digest or matching TOML digest is registered. Exact identity cannot prove source provenance, semantic pointer ownership, collision/warp correctness, safe relocation, emulator operation or Android behaviour. No new write paths have been enabled.

## Next

1. Integrate exact raw-byte hashing into the metadata import transaction, preserving the previous metadata on failure and refusing stale ROM-switch results.
2. Display per-file hashes and explicit unknown/mismatch/multi-file states in the mobile UI, with an updated generated offline HTML checkpoint.
3. Establish a signed/reviewed source-pinned multi-file metadata manifest, independent CUBE fingerprints, and ROM/metadata roundtrip acceptance before considering semantic writes.

Upstream reference: `kcradi/CUBHMA` at pinned commit `3044393183e01af2ae1e907fb37e4a75eda6a8dc`, directory `src/HexManiac.Core/Models/Code`. No commercial ROM images are included.
