# Reviewed warp queue: raw route change preflight

`compareVanillaReviewedRawRoute` in `src/map-route-change-preview.js` compares the shortest raw map-link path before and after a proposed set of vanilla warp-record changes. It does **not** apply or export a patch.

The helper accepts only warp previews produced in the existing eight-byte vanilla warp preview shape. It first checks original ROM bytes and editable fields, then performs the typed, multi-owner queued roundtrip audit. An immutable stale-checked byte overlay supplies the proposed bytes to the existing canonical raw route inspector. The result reports before/after route statuses, hop sequences, changed-byte counts and whether the raw route changed.

The defaults limit a comparison to 16 proposed warp records, 128 declared maps, 8,192 raw links and 128 route hops. Shared event ownership, stale bytes, structural conflicts, unsupported edits and exceeded budgets fail closed. The underlying ROM is never modified. This is a preflight only, not a transactional writer or evidence of allocator/repoint safety.

**Limitations:** vanilla RSE/FRLG raw structures only. No CUBE compatibility, runtime travel, script conditions, collision, emulator or Android hardware acceptance. No strict parity credit. Next: expose queued-route comparisons in the mobile and offline UI after further acceptance, then authenticate real-ROM roundtrips.
