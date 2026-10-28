# Ordered CUBHMA TOML identity manifests (28 October 2026)

CUBHMA's pinned upstream metadata loader uses separate stock, game-specific and custom TOML sources. An exact digest of one overlay, decoded text, or a concatenation cannot establish the identity of the whole ordered file set.

`src/hma-metadata-manifest.js` introduces `validateHmaMetadataManifests` and `compareHmaMetadataManifest`. A manifest explicitly names the **exact ordered** TOML files, each with its own byte length and SHA-256, and binds them to a complete ROM SHA-256, length, four-byte game code, revision, layout label, pinned source commit and GitHub evidence URL. Checks reject missing, reordered, renamed, duplicated, oversized, mismatched and stale inputs. Each file is capped at 4 MiB, with 16 files and 16 MiB aggregate maximum.

The curated manifest registry is intentionally **empty**. Caller-injected manifests are untrusted test or diagnostic inputs, even if every byte matches. The comparison is read-only and always returns `metadataAuthenticated:false`, `cubeLayoutAuthenticated:false`, `independentlyAuthenticated:false` and `semanticWritesAllowed:false`. It does not parse the full HMA DSL, prove overlay precedence, authenticate a ROM build, decode maps, or authorize writes.

Acceptance requires independently sourced CUBE build and matching TOML hashes, correct ordered overlay provenance, authentic map-bank/layout decoding, ROM save/reopen, emulator operation and Android hardware testing. No ROM images, proprietary assets or user-local paths are committed.

Source: pinned [CUBHMA](https://github.com/kcradi/CUBHMA/tree/3044393183e01af2ae1e907fb37e4a75eda6a8dc), including `src/HexManiac.Core/Models/StoredMetadata.cs` and map metadata. Synthetic regression coverage: `tests/hma-metadata-manifest.test.mjs`.
