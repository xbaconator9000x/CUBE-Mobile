# Local-only declared vanilla map smoke check

This tool creates a **read-only structural report** for a ROM you possess
locally. It never uploads the ROM, saves modified ROM bytes, or stores
local file paths in the JSON report.

Create a private, local JSON manifest (do not commit it):

```json
{
  "schema": "cube-mobile-local-map-smoke/1",
  "expectedSha256": "64 lowercase hex characters from a separately checked ROM",
  "family": "RSE",
  "bankTableOffset": 256,
  "bankMapCounts": [2, 1],
  "scanAllScriptAliases": true,
  "scanAllOperandAliases": true,
  "scanRawWarpGraph": true
}
```

The offset and counts above are **illustrative**, not values for an actual
ROM. Replace them with independently verified values for the exact ROM.
The SHA-256 must match the complete local ROM bytes. Use `FRLG` or
`RSE` only for layouts already known to follow the vanilla format.

Run:

```sh
npm run smoke:local -- --rom /local/path/to/your.gba --manifest /local/path/to/your.json
```

Set `scanAllScriptAliases` to `true` to additionally scan all declared vanilla maps for shared object/trigger script targets. The report includes aggregate counts only, never script target offsets, pointer-source bytes or local paths. The opt-in scan fails closed if the 32768-pointer budget is exceeded; omit the flag to keep the existing smaller smoke test.

Set `scanAllOperandAliases` to `true` to inspect bounded fixed-width
vanilla command prefixes from all declared object/trigger scripts and count
shared pointer-operand targets across distinct script source fields.
Repeated events sharing one script are deduplicated. Only aggregate counts
are exported; the scanner does not follow control flow or verify CUBE
target formats. See [operand alias audit](VANILLA_SCRIPT_OPERAND_ALIAS_ATLAS.md).

Set `scanRawWarpGraph` to `true` to add a bounded, canonical pointer-revalidated directed raw warp/connection graph from declared bank 0 / map 0. The JSON contains only aggregate link status counts, reached/not-reached totals and isolated-map counts. No warp source offsets, map header pointers, event bytes or full edge list are exported. Raw reachability is not gameplay accessibility; a non-reached map is not proof of a defect. The optional scan fails closed above 4,096 maps or 65,536 raw links.

On success, the command prints JSON with the matched SHA-256, declared
map counts, up to 16 event-map summaries, shared pointer alias counts,
and explicit **false** values for CUBE authentication, ROM save/reopen,
emulator acceptance, Android acceptance and independent parity evidence.

A matching user-supplied hash verifies identity **against that user's
declaration**, not the declaration's provenance. A structurally plausible
vanilla map does not prove compatibility with a CUBE-expanded ROM. This
tool does not test map edits or emulator behavior. It is groundwork for
future authentic ROM acceptance tests, not itself a verified feature.
No ROM files, local manifest, private data or report artifacts should be
committed to the repository.
