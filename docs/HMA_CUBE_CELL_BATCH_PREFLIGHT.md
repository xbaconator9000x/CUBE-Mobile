# CUBE multi-cell visual preflight (read-only)

Source: pinned CUBHMA MapModel.cs BlockCell encoding and CUBE Emerald custom layout TOML, commit 3044393183e01af2ae1e907fb37e4a75eda6a8dc.

The \`previewHmaCubeCellBatch\` API accepts 1–32 distinct coordinate/expected-original-word proposals in a bounded 32×32 viewport. It rejects stale original words, duplicates, invalid coordinates, unsupported custom lighting and FRLG formats. It computes a single virtual overlay, re-renders both states, checks typed decoded words and reports actual changed pixels. No ROM bytes are mutated and the result cannot authorize saving.

Optional explicitly counted cross-bank ownership analysis reports overlap warnings. Even when zero overlaps are found, a partial census does **not** prove exclusive ownership. Neither genuine CUBE ROM identity nor emulator/Android compatibility has been independently authenticated. No strict parity credit is claimed.

Next: connect an editable touch-first preview queue to this API, authenticate ROM/TOML provenance and demonstrate safe save/reopen on genuine test hardware before enabling semantic writes.
