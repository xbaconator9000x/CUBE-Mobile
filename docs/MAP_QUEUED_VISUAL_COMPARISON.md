# Queued map-cell visual comparison

This checkpoint adds a **read-only**, multi-cell before/after preview for declared vanilla RSE/FRLG map layouts. It is grounded in pinned upstream CUBHMA `MapModel.BlockCells` two-byte metatile/collision encoding and the existing bounded vanilla renderer.

## Mobile workflow

1. Inspect a known vanilla map header and render or inspect its raw blockmap.
2. Preview proposed metatile IDs and/or raw high-six-bit changes for individual cells.
3. Add each preview to the map-change review queue (up to 64 records overall).
4. Choose **Compare queued map-cell changes**. The comparison uses the currently selected vanilla header, family and viewport coordinates. It rechecks all queued records against current ROM bytes, then includes only cell previews for that selected map. Other maps, warps and events are explicitly excluded from the visual comparison.
5. Review original/proposed images, changed rendered pixel count, tile-ID changes and raw high-bit changes. Raw high-bit changes may have no visible effect and are **not** a verified passability interpretation.

The comparator rejects overlapping previews, stale original bytes, forged cell provenance, mixed map headers and unsupported dimensions. It operates through a small read-only staged accessor rather than copying or modifying the ROM. Offscreen queued changes are counted but do not change the visible image.

A separate, generic reviewed-queue byte overlay is available to future inspectors. It rejects changed source bytes at each edited offset, but is **not** a semantic writer, relocation engine or applicable patch.

## Not yet supported

These checks do not authenticate CUBE-specific map grammar, ownership, relocation safety or runtime collision behavior. No queued edits are applied, saved or exported as ROM patches. Authentic ROM roundtrips, emulator acceptance and Android hardware testing are still required for independently verified feature parity.
