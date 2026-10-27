# Mobile shortest raw map-link route explorer

The map atlas screen now offers a **Raw route destination** selector and a read-only **Find shortest directed raw map-link route** action. The currently selected declared map is the origin. After loading a ROM, provide an independently verified vanilla RSE/FRLG map bank table and explicit map counts, inspect the atlas, choose both endpoints and run the route scan.

The result shows the shortest directed sequence of structurally resolved warp/connection references, with a source-byte button and a destination-map button for every hop. Tap a step to inspect its exact ROM bytes, or open its declared destination. Both navigation actions rerun the bounded route inspection and reject changed atlas declarations, selection, map pointers or raw route steps.

Scans are capped at 128 maps, 8,192 raw links and 128 route hops on mobile. Special `0xFF` targets, undeclared targets and invalid warp indexes do not become route edges. An empty result distinguishes a zero-hop same-map route from a map unreachable through resolved raw references.

The standalone offline HTML contains the same controls and route implementation. The UI never writes semantic ROM data.

**Limitations:** raw graph reachability does not establish in-game travel, collision/walkability, scripted warps, map expansion layouts, CUBE compatibility or emulator/Android hardware acceptance. Strict feature parity remains 0/30 pending independent evidence. See [core route semantics](VANILLA_RAW_ROUTE_EXPLORER.md).
