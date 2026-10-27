# Touch blockmap viewport and unverified warp markers — 27 October 2026

The mobile Blockmaps inspector can now pan its 12 × 10 raw cell viewport with large touch buttons. Panning clamps to map bounds and never writes ROM bytes. The existing manual X/Y controls remain available.

When the user explicitly inspects vanilla warp events from a map header, the inspector can annotate corresponding blockmap cells with raw warp indices. Markers appear **only** if the inspected header's blockmap offset and dimensions match the currently displayed raw blockmap. A ROM replacement, raw edit, undo/redo or change of selected layout clears stale warp markers. Out-of-map warps are omitted from the grid but retained in the raw warp list.

The overlay is a read-only positional hint, **not** collision, passability, rendered tiles or authenticated map topology. A plausible vanilla header does not authenticate CUBE map layouts. No semantic writes or repointing. Synthetic tests cover bounds, multiple warps per cell, immutability and offline wiring; Android hardware and authentic ROM acceptance remain outstanding.
