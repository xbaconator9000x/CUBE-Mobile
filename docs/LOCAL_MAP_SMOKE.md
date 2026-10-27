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
  "bankMapCounts": [2, 1]
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
