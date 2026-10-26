# Exact ROM fingerprint compatibility registry — safety checkpoint

Source: `src/rom-compatibility.js`. The bundled `CURATED_ROM_PROFILES` array is intentionally **empty**. No independently authenticated CUBE ROM fingerprint or compatible TOML fingerprint is currently available.

## Why SHA-256 alone is insufficient

A SHA-256 digest identifies **exact bytes**; it does not tell us who produced the ROM, which expansion commit was used, whether its metadata matches, or whether its semantic pointers and map layers are safe to edit. A matching **user-pasted** digest is a useful local byte comparison, but cannot grant trust. Header game code and revision, a filename, `MetadataLayout`, and a `tpte` marker are likewise insufficient. All semantic editors remain read-only.

## Requirements for a future curated entry

A developer must independently establish and document all of the following, using legally held ROMs without committing any ROM image or copyrighted extracted assets:

1. Full-ROM SHA-256 and exact byte length, with the hash computed independently twice.
2. GBA header game code and revision; reject contradictions between the header and the manifest.
3. Source revision and a reviewable HTTPS provenance record explaining the CUBE/stock/custom layout and reproducible build inputs.
4. SHA-256 of the **exact compatible TOML metadata bytes**. A filename, general TOML marker or generic upstream stock reference is not enough.
5. Successful metadata parse, pointer ownership and collision audit, map/collision/warp roundtrip, cross-editor reopen, emulator boot, and Android hardware acceptance.

A profile record requires `sha256`, `length`, `gameCode`, `revision`, `layout`, `metadataSha256`, `sourceCommit` and `evidenceUrl`. Registry validation rejects malformed entries and duplicate ROM digests. The API does not verify metadata bytes yet; therefore **even a matched profile never authorizes semantic writes or relocation**.

## Current workflow

Open a legally obtained ROM locally, compute its staged SHA-256, and optionally paste an independently obtained expected 64-character digest. The interface reports exact match/mismatch. Any edit, patch replacement or ROM switch invalidates the old hash. Nothing is uploaded and the ROM bytes are never changed by fingerprinting or comparison.

**Next:** Obtain independently verified CUBE version/build fingerprints and corresponding metadata digests; implement exact metadata hashing/binding and authentic compatibility tests. Until then, the registry remains empty and every ROM layout remains unverified.
