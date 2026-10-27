# CUBHMA custom map-format hierarchy extraction

This checkpoint adds `extractHmaPointerContent` and `inspectHmaMapFormatHierarchy` in `src/hma-map-format-hierarchy.js`.

The implementation is grounded in pinned upstream [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), whose `Format` constructor checks the map-bank table's `map<...>` pointer format and, for non-vanilla `]1` formats, derives custom layout, events, warp, object, script, signpost, connection and blockset format strings. Upstream uses the presence of a ` cave. ` field as a heuristic for vanilla header shape.

This port conservatively extracts the nested format strings from **supplied metadata text only**. It enforces bounded text length, nesting depth and suffix parsing. It classifies the result as `unresolved`, `unsupported-shape`, `vanilla-marker` or `custom-candidate`, never as an authenticated ROM layout. Synthetic tests cover nested pointer formats, vanilla hints, malformed formats and budgets.

**Important:** This is a preparatory metadata parser, not a full HMA DSL compiler, pointer owner graph, CUBE layout decoder or ROM fingerprint verifier. It does not read or write a ROM and cannot authorize semantic editing. Future work must resolve actual metadata table declarations and versions against authenticated ROM bytes, then add read-only custom map layout inspection and acceptance testing. Strict parity remains unchanged.
