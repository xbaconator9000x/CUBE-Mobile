# Local CUBE bank-table raw smoke (opt-in)

Run `npm run smoke:cube-banks -- --rom /path/to/local.gba --metadata /path/to/local.toml --expected-sha256 <exact-64-hex>`. All input stays on the local machine; do not upload or commit ROMs or copyrighted game assets. Supply an independently calculated SHA-256 to prevent accidentally testing the wrong local ROM.

The command checks the full ROM hash, parses an unambiguous HMA `data.maps.banks` declaration, requires a bounded fixed outer table count and reports aggregate raw pointer-shape statistics. It never prints paths, ROM bytes, source offsets, target offsets, or the supplied SHA. It never patches or saves ROM data.

**A user-supplied hash is not an authenticated CUBE build.** Even a matching hash and plausible pointers cannot verify map-bank layouts, map counts, rendering, collision semantics, safe editing or gameplay. The report explicitly records these limitations and cannot earn strict parity credit. Genuine ROM provenance, save/reopen, emulator and Android acceptance remain necessary.

## Optional bounded second-hop census

Add `--target-words 4` (1–16 permitted) to sample a fixed number of raw 32-bit words at each unique, aligned in-ROM target of the declared bank table. The report adds only aggregate counts for sampled targets, nested pointer-shaped words, duplicates, truncations and overlaps. It does **not** include source/target addresses, raw words, ROM data, metadata contents or file paths. Without this flag the original first-hop census remains unchanged.

The sampled bytes are not verified CUBE map pointers, map counts, layouts, event records or editing permissions. The ROM remains unmodified and the supplied SHA-256 remains a local equality check, not independent authentication.
