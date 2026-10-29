# Local CUBE bank-table raw smoke (opt-in)

Run `npm run smoke:cube-banks -- --rom /path/to/local.gba --metadata /path/to/local.toml --expected-sha256 <exact-64-hex>`. All input stays on the local machine; do not upload or commit ROMs or copyrighted game assets. Supply an independently calculated SHA-256 to prevent accidentally testing the wrong local ROM.

The command checks the full ROM hash, parses an unambiguous HMA `data.maps.banks` declaration, requires a bounded fixed outer table count and reports aggregate raw pointer-shape statistics. It never prints paths, ROM bytes, source offsets, target offsets, or the supplied SHA. It never patches or saves ROM data.

**A user-supplied hash is not an authenticated CUBE build.** Even a matching hash and plausible pointers cannot verify map-bank layouts, map counts, rendering, collision semantics, safe editing or gameplay. The report explicitly records these limitations and cannot earn strict parity credit. Genuine ROM provenance, save/reopen, emulator and Android acceptance remain necessary.

## Optional bounded second-hop census

Add `--target-words 4` (1–16 permitted) to sample a fixed number of raw 32-bit words at each unique, aligned in-ROM target of the declared bank table. The report adds only aggregate counts for sampled targets, nested pointer-shaped words, duplicates, truncations and overlaps. It does **not** include source/target addresses, raw words, ROM data, metadata contents or file paths. Without this flag the original first-hop census remains unchanged.

The sampled bytes are not verified CUBE map pointers, map counts, layouts, event records or editing permissions. The ROM remains unmodified and the supplied SHA-256 remains a local equality check, not independent authentication.

## Optional custom CUBE map structural smoke

To inspect a **specific** map using the pinned CUBE Emerald custom map layout, append `--bank-index 0 --map-index 0 --map-count 1` to the base command. The per-bank map count is mandatory and supplied by the operator: CUBHMA's nested map array is dynamically sized, and this tool does not infer it. Valid counts are 1–1024. The CLI verifies the ROM against the separately supplied SHA-256 before resolving the custom 28-byte map header, 28-byte layout, raw blockmap span and event/warp arrays.

The opt-in JSON report contains only the selected bank/map indexes, declared map count, dimensions, raw cell count, event counts and aggregate out-of-map/special warp counts. It does not print pointer addresses, source offsets, raw ROM bytes, hashes or local file paths. The command never writes the ROM and rejects malformed metadata or overlapping structures.

A matching user-supplied hash is an **identity check**, not independent evidence that the ROM is a genuine CUBE build. No collision/passability, script or warp reachability semantics are authenticated. Strict parity remains unchanged pending genuine ROM, emulator and Android testing.


## Opt-in local CUBE RSE render compatibility check

Add \`--render-map 1\` alongside the explicit \`--bank-index\`, \`--map-index\` and \`--map-count\` selection. After exact local ROM SHA-256 matching, the command attempts the conservative CUBE Emerald RSE renderer on the first 10 × 8 cells. Unsupported CUBE light palettes, FRLG layouts, malformed blocksets and truncated graphics fail closed. The report adds **only** the rendering mode and aggregate metatile/pixel counts. It does not emit the rendered image, raw pixels, palette values, ROM bytes, offsets, paths or the supplied digest.

This provides a reproducible local smoke check for a ROM you already possess, not independent provenance or a full renderer acceptance test. Do not commit the ROM or metadata containing proprietary assets. Strict parity remains unchanged until authentic source provenance, emulator, Android and save/reopen evidence is independently reviewed.

## Exact upstream CUBE Emerald TOML provenance and input integrity

The local smoke now independently compares the **raw bytes** of the imported TOML to the pinned public `kcradi/CUBHMA` source revision `3044393183e01af2ae1e907fb37e4a75eda6a8dc`, file `src/HexManiac.Core/ViewModels/QuickEditItems/cube_emerald.toml` (435,942 bytes, SHA-256 `09bf893bb7bf06fefe88e3721129ca443927f9e36bc3320316a6bdb383b3f068`, Git blob `1261b72a7d07a242b48a6f0517c625e14812ae78`). This is a **metadata provenance** check, not an authenticated CUBE ROM/build profile. No upstream TOML or ROM assets are bundled.

The report adds `upstreamMetadataExactBytesMatched`, `upstreamMetadataPinnedRequired`, and `romBuildProvenanceVerified:false`. Add `--require-pinned-toml 1` to refuse any modified, truncated, repackaged or alternative metadata. Default behavior remains compatible with synthetic/local TOML, but clearly reports unverified provenance. A full 128 MiB local ROM input budget remains supported. The ROM and TOML are opened through the shared symlink- and inode-checking input boundary, then reopened and byte-compared after inspection to catch changed sources. This does not eliminate every concurrent filesystem attack, and it never grants write permission or strict parity.
