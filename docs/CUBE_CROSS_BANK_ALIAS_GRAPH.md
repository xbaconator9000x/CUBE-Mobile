# CUBE cross-bank structural alias graph

The read-only `auditHmaCubeCrossBankOwnership` report now returns a **complete map-level adjacency graph** for the explicitly counted CUBE banks, even when its retained byte-overlap findings are truncated by `maxFindings` or focused on one map.

- `directAliasMapPairCount` counts distinct map pairs with at least one overlapping decoded structural byte span. Multiple overlapping header, layout, event, connection, blockmap or map-script claims count as one direct pair.
- `crossBankDirectAliasMapPairCount` counts distinct direct pairs from different banks.
- `aliasComponents` groups maps connected by one or more direct overlaps, with stable numeric map ordering, bank indices, direct pair counts and `transitiveOnlyPairsPossible`. **Component membership is not proof that every pair overlaps**: a map can share bytes with two maps that do not share bytes with one another.
- `mapAliasSummaries` includes each requested map slot. Invalid/unsupported maps have zero claims and `componentMapCount: 0`, rather than being misrepresented as clean isolated maps. Decoded isolated maps have `componentMapCount: 1`.
- Existing `relationships`, `sameMapRelationships`, focused counts and truncation flags retain their meanings. Alias graph counts are computed before filtering retained findings.

The census is bounded to eight banks and 256 maps, uses only declared counts, and does not scan unknown banks or all potential GBA pointers. Event, connection and map-script claims are opt-in and decoding failures are reported separately. Shared bytes can be intentional. **Neither an empty graph nor a complete graph authorizes ROM writes or establishes authenticated CUBE metadata, exclusive ownership, emulator correctness or save/reopen acceptance.**

Regression coverage includes transitive cross-bank overlaps, heavy aliasing under a one-finding budget, invalid slots and source preservation. Upstream structural basis: `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc` MapModel custom map pointers and layout.
