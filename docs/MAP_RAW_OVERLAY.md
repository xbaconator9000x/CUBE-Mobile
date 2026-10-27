# Raw map attribute colour overlays

The mobile vanilla metatile renderer can colour-code the raw six high bits of each blockmap cell, metatile behavior bytes, and (FRLG only) terrain or encounter attribute fields. This is a **categorical byte-value overlay** with a legend, not a walkability, encounter-probability or collision-rule interpretation.

The pure overlay builder reads only the already rendered 12 × 10 viewport attributes, produces stable colour swatches, counts raw values and reports first coordinates. It does not read, mutate, export or authenticate ROM data. Missing family-specific fields fail closed; a synthetic test suite covers grouping, determinism, bounds and non-mutation.

This is based on the pinned CUBHMA vanilla blockmap/metatile field decoding already implemented in `map-render.js`. Authentic CUBE layouts, collision semantics, Android hardware and emulator roundtrips remain unverified.

## Raw grid fallback

The raw 12 × 10 blockmap cell grid now has an independently selectable coloured left-border indicator for the six-bit high word. This works even when metatile graphics cannot be rendered. The legend counts only visible cells, and disabling the checkbox restores the uncoloured grid. The palette is identical to the rendered map overlay; neither represents collision/passability semantics.
