# Read-only ROM/TOML cross-source provenance binding

**Status: partial Q016 implementation. No CUBE ROM is authenticated and no semantic writes are enabled.**

The desktop upstream is pinned to `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`. Its ROM identity, metadata overlays, and custom map formats must be independently verified before editing. This repository contains **no ROM image or curated ROM/metadata manifest**.

`src/hma-rom-provenance-binding.js` exposes `compareRomHmaProvenance(model, romFingerprint, orderedMetadataFingerprints, {profiles, manifests})`. It intersects the already validated full-ROM SHA-256/size/header profile with the exact ordered TOML file-set manifest, and then checks that both declarations agree about ROM identity, revision, layout and upstream source commit.

The result is explicitly **read-only**. Matching injected profiles/manifests are useful consistency evidence, **not** independent authentication. An exact TOML digest alone cannot establish metadata parsing correctness, pointer ownership, game compatibility, or ROM write permission.

## Fail-closed cases

- Missing ROM profile, missing manifest, stale ROM fingerprint, header mismatch or changed TOML bytes
- Different TOML order, filenames, file count or exact per-file SHA-256
- Contradictory layout, source revision or single-file profile digest
- Multiple TOML overlays: the legacy single-file `metadataSha256` profile field **cannot** bind the whole ordered set. The result is `multi-file-profile-unbound` even when the manifest matches.

The cross-source comparison never enables semantic writes, relocation or claims of emulator/Android acceptance. It returns only status, evidence counts and false acceptance flags, not private ROM paths or raw bytes. Synthetic regression fixtures live in `tests/hma-rom-provenance-binding.test.mjs`.

## Remaining Q016 acceptance

Independently authenticate a legally held CUBE ROM and matching ordered TOML files, establish a source-grounded manifest/provenance chain, and wire the resulting read-only status into the touch/offline UI. Do not curate a profile from a user-supplied hash, filename, ROM header or TOML layout marker. Q003 and downstream semantic editing remain blocked until genuine evidence exists.

## Local-only cross-source acceptance command

The existing `npm run smoke:cube-manifest -- --rom /private/owned.gba --manifest /private/ordered.json --metadata /private/default.toml` workflow now accepts **optional** `--profile /private/rom-profile.json`. Supply each `--metadata` argument in the exact manifest order. The separate profile is a single JSON object containing `sha256`, `length`, `gameCode`, `revision`, `layout`, `metadataSha256`, `sourceCommit` and `evidenceUrl`. It must agree with the independently supplied ordered TOML manifest and the actual local ROM bytes. The CLI reports `crossSourceStatus` and `crossSourceClaimsConsistent` without printing private paths, hashes, ROM or TOML contents.

All ROM, manifest, profile and TOML inputs are now read using the shared stable local file reader, which rejects symlink traversal, changing pathname/inode/size/timestamps and oversized files. The separate profile is **not a curated registry**. A consistent user-supplied profile is only an exact-byte *claim*, never authenticated CUBE compatibility or semantic write authority. The legacy profile has one `metadataSha256` and cannot authenticate an ordered multi-file overlay: the explicit `multi-file-profile-unbound` status remains a blocker. When a profile is supplied, optional raw bank inspection is refused unless both sources report consistent exact-byte claims. Without `--profile`, the previous manifest-only read-only smoke remains available.

The new local regression tests cover single-file agreement, multi-file unbound profiles, layout/digest conflicts, unknown ROM profiles, symlink inputs, malformed/aliased profile files and CLI privacy. Genuine independently authenticated ROM/metadata, emulator and Android hardware acceptance are still missing.
