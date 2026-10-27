# Local vanilla event-script smoke audit

The map event script inspector in `src/vanilla-map-script-audit.js` checks
object and trigger pointers from an **explicitly declared vanilla RSE/FRLG**
map header, using the pinned-upstream bounded command prefix and branch
pointer classifiers. It inspects at most 32 records per map by default,
with at most 64 bytes and 16 commands per script target. It never follows
branches or interprets unknown commands.

The local SHA-256-matched map smoke tool now reports aggregate pointer
statuses and decode stop reasons for the first 16 declared maps. It does
not output script bytes or executable patch data. Run with:

```sh
node scripts/local-map-smoke.mjs --rom /path/to/local.gba --manifest /path/to/local.json
```

The manifest must contain the independent exact ROM SHA-256, family,
map-bank table offset and explicit map counts described in
[LOCAL_MAP_SMOKE.md](LOCAL_MAP_SMOKE.md). No ROM or manifest is committed.

A matching user-provided hash is not independent provenance. A valid
vanilla script prefix does not prove script ownership, CUBE grammar,
runtime behavior, ROM editability or feature parity. Invalid structures
fail closed; ambiguous command bytes are not decoded beyond the first
unknown opcode. Genuine CUBE compatibility, save/reopen, emulator and
Android hardware tests are still required.
