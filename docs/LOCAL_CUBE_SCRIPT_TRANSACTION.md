# Local CUBE script transaction acceptance rehearsal

Run against **your own locally held ROM and matching CUBE TOML**. No copyrighted ROM is shipped or uploaded. First calculate your ROM's SHA-256 independently. Prepare a JSON plan containing `changes` with `kind`, `index`, `expectedRaw`, `targetKind` and `targetIndex`. Each target is another script-bearing event in the selected map, not an arbitrary pointer. For example, `{"changes":[{"kind":"objects","index":0,"expectedRaw":134259968,"targetKind":"objects","targetIndex":1}]}` (numbers are illustrative, not authenticated).

```sh
npm run smoke:cube-scripts -- \
  --rom /local/path/to/game.gba \
  --metadata /local/path/to/cube_emerald.toml \
  --expected-sha256 YOUR_64_HEX_ROM_DIGEST \
  --bank-index 0 --map-index 0 --map-count 1 \
  --plan /local/path/to/changes.json
```

The command checks exact user-declared ROM identity, parses the pinned CUBHMA custom map metadata, protects hidden-item signpost unions, preflights changes, applies to an isolated in-memory copy, re-decodes all events, rolls back and verifies the ROM file remained unchanged. Only aggregate results appear in stdout. Paths, ROM bytes, pointer addresses, hashes and script bytes are not included. Malformed or stale input fails closed.

**Limitations:** A caller-provided digest does not authenticate CUBE provenance. No script instructions are parsed or executed. No modified ROM or patch is exported, no emulator or Android validation is claimed, and this does not satisfy the strict parity gate. Source for the event union: [pinned CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs).
