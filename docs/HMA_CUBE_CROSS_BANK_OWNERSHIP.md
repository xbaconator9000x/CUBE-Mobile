# CUBE cross-bank ownership census

Inspects at most 256 explicitly enumerated CUBE maps across at most eight banks. Reports exact and partial byte-range overlap for map headers, layouts and blockmaps, including across banks. Invalid maps remain visible instead of being silently omitted.

This is a **partial read-only census**: a non-overlap finding cannot prove exclusive ownership, because other map banks, dynamic references and editor metadata may point at the same bytes. No write permission is granted. Source grounding: pinned CUBHMA MapModel.cs and cube_emerald.toml. Genuine ROM authentication, emulator, Android and save/reopen tests are still required.

## Optional event-array ownership (28 October 2026)

Enable **Include event groups and arrays** in the mobile cross-bank audit to add the pinned CUBE fixed-width event group (20 bytes) and the declared object (24), warp (8), script trigger (16), and signpost (12) record arrays to the ownership census. The scanner now detects cross-map/cross-bank overlaps with these spans and reports same-map claim collisions separately. Malformed or unsupported event arrays are recorded in `eventIssues` without silently dropping the otherwise decoded map slot.

This is an intentionally **incomplete** census: declared banks may omit other owners, pointer aliases or dynamic references. The decoder does not follow script pointers, infer ownership of scripts, authenticate the ROM, or authorize writes. The toggle and bank counts are revalidated before navigating a finding. Synthetic fixtures demonstrate shared event-group and warp-array claims; no genuine CUBE ROM acceptance is implied.
