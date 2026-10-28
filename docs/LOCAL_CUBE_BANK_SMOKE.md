# Local CUBE bank-table raw smoke (opt-in)

Run `npm run smoke:cube-banks -- --rom /path/to/local.gba --metadata /path/to/local.toml --expected-sha256 <exact-64-hex>`. All input stays on the local machine; do not upload or commit ROMs or copyrighted game assets. Supply an independently calculated SHA-256 to prevent accidentally testing the wrong local ROM.

The command checks the full ROM hash, parses an unambiguous HMA `data.maps.banks` declaration, requires a bounded fixed outer table count and reports aggregate raw pointer-shape statistics. It never prints paths, ROM bytes, source offsets, target offsets, or the supplied SHA. It never patches or saves ROM data.

**A user-supplied hash is not an authenticated CUBE build.** Even a matching hash and plausible pointers cannot verify map-bank layouts, map counts, rendering, collision semantics, safe editing or gameplay. The report explicitly records these limitations and cannot earn strict parity credit. Genuine ROM provenance, save/reopen, emulator and Android acceptance remain necessary.
