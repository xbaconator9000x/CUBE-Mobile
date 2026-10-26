# Metadata SHA-256 checkpoint

`src/metadata-digest.js` hashes the exact imported Uint8Array metadata bytes with WebCrypto SHA-256 (up to 4 MiB). No BOM removal, newline normalization, parsed-text reserialization, or filename trust is applied. It snapshots input before the async digest and does not mutate ROM or metadata.

The comparison result **always** sets `authorizesWrites: false` and `provenanceVerified: false`. This is an identity primitive, not a curated-profile authentication system.

**Outstanding:** Wire raw file bytes into the local import flow; match them against independently verified ROM+metadata registry entries; add CUBE authentic fixtures, semantic ownership and Android roundtrip acceptance before enabling any structured writes. The curated profile registry remains empty.
