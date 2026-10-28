# Local ordered CUBE TOML identity smoke (28 October 2026)

Use the opt-in `npm run smoke:cube-manifest --` command to check an **existing, locally supplied** ROM and ordered metadata files against a separately prepared JSON manifest. The command never edits or exports the ROM, TOML or manifest. The console report contains only statuses, file counts and explicit negative acceptance flags, not hashes, ROM bytes, addresses or file paths.

Example (all paths remain local):

```sh
npm run smoke:cube-manifest -- --rom ./local.gba --manifest ./local-manifest.json --metadata ./default.toml --metadata ./cube_emerald.toml
```

The manifest schema uses `romSha256`, `romLength`, `gameCode`, `revision`, `layout`, `sourceCommit`, `evidenceUrl` and an ordered `files` array. Each file entry requires `name`, `length` and `sha256`. The file names must be unambiguous basenames ending in `.toml`. Every file is checked by its **exact bytes**; no concatenation, text normalization or overlay precedence is assumed.

Limits: 128 MiB ROM, 128 KiB manifest, 16 metadata files, 4 MiB each, 16 MiB combined. Files are read without writing and are checked for size/mtime changes during reading. Any mismatch or invalid declaration fails closed. Synthetic tests use locally generated fake ROM bytes only.

**Security boundary:** The manifest is supplied by the caller and is **not** independently curated. An exact match does not establish authentic CUBE build provenance, correct map-bank/layout decoding, safe editing, emulator acceptance or Android hardware compatibility. The bundled curated manifest registry remains empty and strict parity remains unchanged.

See [ordered manifest model](HMA_ORDERED_METADATA_MANIFEST.md) and pinned [upstream CUBHMA](https://github.com/kcradi/CUBHMA/tree/3044393183e01af2ae1e907fb37e4a75eda6a8dc).
