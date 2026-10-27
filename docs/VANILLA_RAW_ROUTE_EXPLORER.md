# Shortest raw vanilla map-link route (read-only)

This checkpoint adds `inspectVanillaAtlasRawRoute` in `src/map-route-explorer.js`. It inspects an **explicitly declared** RSE/FRLG map atlas and finds a deterministic shortest directed path of raw warp/connection references from one bank/map to another.

## Source and interpretation

Pinned upstream: [kcradi/CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), specifically the vanilla event/warp and map-connection layouts. Reuses existing canonical atlas pointer, layout and event validation from the raw graph auditor.

Each returned step identifies its source and target map, link kind, record index and **ROM byte offset**; warp steps retain the destination warp index, connection steps retain direction and signed displacement. Routes are shortest by link count, with deterministic tie-breaking by atlas order, then warp record order, then connection record order.

Only links to declared maps with structurally valid destination warp indexes count as edges. Special `0xFF` references, undeclared maps and invalid destination warp indexes are excluded, not guessed. The API distinguishes unreachable routes, zero-hop self-routes, and budget violations. A too-long shortest path throws rather than falsely reporting unreachable.

The audit is bounded (default 256 maps, 16,384 raw links and 256 displayed hops). It fails closed on stale/forged atlas provenance and malformed records. It never mutates ROM bytes or emits a patch. A ROM accessor may change during a scan; resolved-link counts are cross-checked to catch inconsistent structural reads, but this is not a concurrency-safe snapshot guarantee.

## Not authenticated

This is **raw graph reachability, not actual gameplay travel**. It does not evaluate collision, one-way ledges, script-driven warps, runtime conditions, hidden triggers, CUBE extensions or event execution. It does not authorize editing or establish a CUBE ROM fingerprint. No strict parity credit is claimed.

## Follow-up

Expose route inspection in the touch-first and offline interfaces, with stale-result checks before navigation; verify against an independently authenticated CUBE ROM; then pursue save/reopen, emulator and Android hardware acceptance. Do not bundle ROM files in the repository.
