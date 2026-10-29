# Read-only ordered ROM/TOML manifest comparison on Android and offline HTML

The **Named data** screen accepts an optional local JSON manifest (maximum 64 KiB) with the same schema as `validateHmaMetadataManifests`. Load a legally held ROM, import the exact TOML files in manifest order, compute the current ROM SHA-256, then import the manifest. The comparison checks the live ROM SHA-256, length and game header plus every ordered TOML filename, size and raw-byte SHA-256.

This is a **caller-supplied claim only**. Even an exact match does not establish independent CUBE provenance, authentic layouts, safe pointer ownership, semantic editing rights or game compatibility. No ROM, TOML or manifest bytes are uploaded or stored persistently; the manifest claim is cleared on ROM replacement or metadata reset and is never exported as an editing authorization. A staged ROM edit makes the old fingerprint stale. Missing, reordered or modified TOML files are reported distinctly.

The modular app and generated offline HTML expose the same UI. Acceptance still requires an independently authenticated CUBE ROM/metadata set, physical Android SAF/provider tests and emulator reopen/gameplay verification. No ROM binaries or credentials are included.
