# Vanilla event coordinate integrity review (read-only)

This mobile checkpoint checks raw event coordinates against the **declared vanilla map blockmap**. It does not identify, authenticate, or edit CUBE-specific formats.

## Source and behavior

The record fields come from pinned [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), including vanilla warp, object, trigger and signpost coordinates. Map header, dimensions and blockmap offsets are re-read and checked against the selected atlas entry to reject stale layouts.

From **Blockmaps → Catalog explicitly declared vanilla maps**, select a map and choose **Review selected map event coordinates and shared cells**. The result counts all four event families, highlights records outside the declared blockmap and reports multiple event records occupying the same in-map coordinate. Shared coordinates are informational: legitimate triggers, objects, signposts or warps can overlap. No passability, script execution, or map correctness is inferred.

Each finding preserves its source record ROM offset, coordinate, and (for in-bounds cells) exact 16-bit blockmap source offset, raw 10-bit tile ID and raw six high bits. Tap a finding to inspect its record in hex. No bytes are modified.

At most 1,020 raw events are inspected (255 records per family); no more than 128 findings are displayed in the mobile UI. Results indicate truncation. The pure function supports a 1–256 finding cap, synthetic staged byte readers, strict byte validation and immutable results. ROM replacement, raw byte edits and atlas changes invalidate the UI. The standalone offline HTML bundles the same inspection.

## Verification limits

Synthetic ROM unit tests check shared/out-of-map records, exact offsets, raw high-bit preservation, staged reads, stale atlas rejection and bounds. This is **not** a CUBE layout signature, collision/walkability decoder, safe semantic editor, authentic ROM roundtrip, emulator or Android hardware acceptance. No feature family is upgraded to independently verified parity by this checkpoint.

## Atlas-wide review

Use **Review next 16 maps for raw event coordinate issues** to inspect a bounded page of the manually declared vanilla map catalog. All event counts and flagged statuses are aggregated, while at most 128 findings are shown. The next page requires another tap; the cursor resets when the atlas is invalidated. Findings include bank/map IDs and exact ROM record offsets for touch-to-hex navigation.

A malformed event pointer, invalid staged byte or stale layout aborts the batch instead of returning partial results. This does not prove that overlapping events are erroneous or that any raw collision bits imply passability. It does not establish 20% parity.
