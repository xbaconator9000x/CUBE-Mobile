# Incoming vanilla map links — read-only checkpoint

**Source:** pinned [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), specifically WarpsFormat (x, y, elevation, warpID, map, bank) and ConnectionsFormat (direction, offset, mapGroup, mapNum, unused).

The bounded reverse-reference scan examines at most 32 declared maps per call (default 16), returning at most 256 records (default 128), while counting every matching record in the page. It reports source bank/map, source record ROM offset, raw warp ID and status. A warp index of 255 is special/unresolved; an index beyond the destination's current raw warp count is a structural warning, not proof of invalid runtime behavior. Connections do not have warp IDs. Results are paginated, so absence from one page does not mean a map has no inbound links.

Every source map and destination is rechecked against its stored map-pointer source, map header, layout, dimensions and blockmap offset before interpretation. The caller must still provide explicit bank counts and vanilla family. This neither authenticates a CUBE layout nor verifies a real runtime teleport, collision or connection behavior. ROM bytes are never written.

Synthetic tests cover exact source offsets, pagination, truncation, raw special/invalid warp indexes, stale pointers/layouts, staged accessors and immutability. Authentic ROM and emulator acceptance, Android device testing and semantic editing remain outstanding.

## Mobile usage

In the Blockmaps atlas section, inspect an explicitly declared vanilla atlas, select a destination map, and choose **Find incoming links**. Each press scans the next 16 declared source maps, showing incoming warp and connection records with their exact ROM offsets. Tap a record to inspect its bytes or open its source map. Changing the destination or replacing the ROM resets the scan. Reinspect after changing bank counts, bank-table offset or family. The scan does not establish that a teleport or connection functions in an emulator.
