# CUBE cross-bank ownership census

Inspects at most 256 explicitly enumerated CUBE maps across at most eight banks. Reports exact and partial byte-range overlap for map headers, layouts and blockmaps, including across banks. Invalid maps remain visible instead of being silently omitted.

This is a **partial read-only census**: a non-overlap finding cannot prove exclusive ownership, because other map banks, dynamic references and editor metadata may point at the same bytes. No write permission is granted. Source grounding: pinned CUBHMA MapModel.cs and cube_emerald.toml. Genuine ROM authentication, emulator, Android and save/reopen tests are still required.

## Optional event-array ownership (28 October 2026)

Enable **Include event groups and arrays** in the mobile cross-bank audit to add the pinned CUBE fixed-width event group (20 bytes) and the declared object (24), warp (8), script trigger (16), and signpost (12) record arrays to the ownership census. The scanner now detects cross-map/cross-bank overlaps with these spans and reports same-map claim collisions separately. Malformed or unsupported event arrays are recorded in `eventIssues` without silently dropping the otherwise decoded map slot.

This is an intentionally **incomplete** census: declared banks may omit other owners, pointer aliases or dynamic references. The decoder does not follow script pointers, infer ownership of scripts, authenticate the ROM, or authorize writes. The toggle and bank counts are revalidated before navigating a finding. Synthetic fixtures demonstrate shared event-group and warp-array claims; no genuine CUBE ROM acceptance is implied.

## Map-script ownership extension (29 October 2026)

The bounded cross-bank census now optionally claims the five-byte, type-0-terminated map-script table and each type 2/4 conditional table (8 bytes per condition plus the two-byte terminator), using the pinned CUBHMA `MapModel.cs` / `MapScriptCollection.cs` formats. A malformed table is recorded separately as `mapScriptIssues` rather than silently treated as unowned. The changed-byte impact audit **always** includes map-script claims, so a warp/event/cell/connection/script-reference edit aliasing these structures is reported as a conflict. Missing or invalid script tables make the census incomplete, never safe. The bounded census still does not prove global ownership, ROM authenticity, or write permission.

## Mobile ownership inspector (29 October 2026)

The touch-first cross-bank ownership inspector now **always** includes bounded map-script table and conditional table claims, even when the optional event/connection toggles are off. It displays invalid map-script table counts separately, and its stale-result click guard rechecks the same coverage before navigating. The combined editing ownership report also surfaces map-script failures. The offline HTML is regenerated from the same source. No inferred bank map counts, global pointer exclusivity, ROM authentication or write authorization are claimed.

## Same-map structural aliases (29 October 2026)

The bounded census now separately reports `sameMapStructuralOverlapCount` and `sameMapStructuralAmbiguityDetected` when two independently decoded structures of the **same** map claim overlapping ROM bytes. The changed-byte ownership impact report treats any such ambiguity as an incomplete census, even if the particular proposed edit does not intersect the ambiguous bytes. A synthetic event-warp/map-script-table alias regression demonstrates why structurally plausible decoders cannot establish exclusive ownership. These are diagnostics, not evidence of a globally complete pointer graph or authorization to save edited ROMs.
