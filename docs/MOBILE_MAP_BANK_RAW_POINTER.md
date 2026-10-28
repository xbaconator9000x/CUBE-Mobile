# Read-only raw map-bank anchor pointer inspection

The Named Data map-bank panel can inspect the **four raw bytes** at an unambiguous, in-bounds `data.maps.banks` anchor from imported CUBHMA TOML. It displays the unsigned little-endian word and whether it resembles a conventional GBA ROM pointer (`0x08000000`–`0x09FFFFFF`). The **Follow raw pointer** control is enabled only for an in-bounds target and re-reads the staged source bytes before navigating.

This is raw-byte evidence, **not** authenticated CUBE map-bank discovery. The anchor may contain a scalar, a table element or a pointer under an unknown custom DSL. The inspector does not infer map counts, bank layout, collision, warp ownership or write authority. Conflicting, ambiguous, out-of-ROM and stale declarations fail closed. It never changes ROM bytes.

The modular and offline apps expose the same controls. Synthetic tests cover pointer classification, bounds, staged changes, read-only guarantees and UI presence. Genuine CUBE ROM/metadata fingerprints, custom layout decoding, emulator and Android hardware acceptance are still missing; strict feature parity remains 0/30.
