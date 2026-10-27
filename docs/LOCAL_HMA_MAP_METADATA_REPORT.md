# Local CUBHMA map metadata report

Run from the repository root with **locally obtained TOML metadata files**:

```sh
npm run map:metadata:inspect -- --rom-size 33554432 /path/to/common.toml /path/to/custom.toml
```

The optional `--rom-size` is a decimal number of bytes (maximum 128 MiB). Without it, the report cannot establish whether the named anchor's address lies within a ROM. This command **never reads a ROM**; the size is only a declared bound.

The tool reads at most 64 local UTF-8 TOML files (4 MiB each, 16 MiB total), parses the `data.maps.banks` anchor, reports exact declaration addresses, source basenames, line numbers, conflicts and available map-format section names. It does not print raw TOML content, full local paths or ROM bytes. Unknown/missing/contradictory formats return exit status 2; a `custom-candidate` or `vanilla-marker` report returns 0 but is **not** an authentication or safety pass.

This is an optional developer diagnostic to help collect source-grounded CUBE layout evidence. It does not run in the mobile UI, inspect the ROM's actual map pointers, resolve CUBHMA's full metadata overlay semantics, authenticate versioned CUBE builds or permit semantic editing. All strict parity gates remain unchanged.

Next: connect the metadata source provenance to the mobile Named Data interface, independently verify exact ROM + TOML fingerprints, and implement bounded custom layout decoding followed by real-ROM, emulator and Android roundtrip acceptance.
