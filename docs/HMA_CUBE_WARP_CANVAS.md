# CUBE warp markers on rendered map — raw overlay

The supported CUBE Emerald RSE touchscreen map canvas now offers a
**Warp source markers and destinations** overlay. Warp coordinates within
the current viewport are outlined and numbered; the legend lists raw
destination bank, map and warp indexes. Special destinations are visually
distinguished. The overlay is read-only and available in the offline HTML.

A tap on the rendered map revalidates both the underlying rendered cells
and the complete raw event/warp report before navigating or selecting a cell.
Unsupported event structures fail closed rather than showing stale markers.

These are raw event coordinates from the pinned CUBHMA CUBE Emerald
metadata format, not proof that a warp is accessible, correctly scripted,
walkable or executable in an emulator. No ROM writing or strict parity
credit is enabled.
