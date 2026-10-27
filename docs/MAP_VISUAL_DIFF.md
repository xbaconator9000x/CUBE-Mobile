# Read-only metatile visual comparison

The selected vanilla RSE/FRLG map cell can be compared visually against a proposed tile ID and/or six-bit raw collision/elevation word. This follows the pinned CUBHMA `BlockCells` two-byte packing and the existing metatile renderer.

`compareVanillaBlockmapVisualChange` revalidates the original ROM bytes, the selected map header/layout, the preview's byte offset, and all editable fields. It constructs a **read-only two-byte overlay accessor** for the proposed view, rather than copying or modifying the ROM. It renders the same bounded viewport twice, reports exact changed-pixel counts and bounding rectangles, and distinguishes visual metatile changes from raw collision changes that produce no visual difference.

**Limitations:** vanilla structures are manually selected and unauthenticated; CUBE layouts, tile ownership, collision/passability meanings, script effects, save/reopen and emulator operation are not verified. No semantic writes, patch output, or ROM asset bytes are produced. Synthetic tests establish local invariants only.

## Mobile preview workflow

Select a vanilla header and inspect its blockmap. Enter or tap a cell, propose a tile ID and/or raw high-bit value, and select **Preview original and proposed bytes**. The **Compare proposed map appearance** control renders side-by-side local images from the same bounded viewport. If the selected cell is outside the current viewport, the comparison recenters on it. The status reports changed pixel counts and whether only nonvisual raw bits changed. A changed proposal must be previewed again before comparison. This feature never enables ROM writes or claims walkability.
