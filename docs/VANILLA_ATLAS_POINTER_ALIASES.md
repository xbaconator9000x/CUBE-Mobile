# Declared vanilla map pointer aliases (read-only)

Source: pinned [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), including the map-bank pointer table, map header layout pointer and layout blockmap pointer.

The mobile Blockmaps atlas offers **Review shared map header/layout/blockmap pointers** after inspecting an explicitly declared vanilla map catalog. It reports exact shared ROM offsets and the bank/map references to each target, preserving the pointer-field source locations:

- Map header: the map pointer in its bank array.
- Map layout: the first pointer word of the map header.
- Blockmap: the pointer at layout header offset +12.

Exact shared targets are **not automatically defects**. Maps can legitimately reuse layouts, blockmaps and even headers. The report is an ownership warning for future editing and relocation work, not proof of uniqueness or of a safe write location.

The pure audit supports 1–256 displayed alias groups and 1–32 references per group; mobile displays at most 64 groups and eight references each. Totals cover all alias groups, and truncation is explicit. Tap a group to inspect its first pointer source in hex. The catalog is invalidated on ROM, metadata and atlas changes. This does not scan or mutate ROM bytes.

**Outstanding:** independent CUBE ROM/layout authentication, metadata-based ownership and shared-run semantics, pointer relocation, semantic editing, save/reopen roundtrips, emulator and Android hardware acceptance. Synthetic tests do not establish full feature parity.
