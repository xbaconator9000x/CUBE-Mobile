# Bounded cross-page vanilla script target alias audit

The read-only `auditVanillaScriptAliasesAcrossPages` scans up to 256 **explicitly declared** RSE/FRLG map entries in one operation, including references that fall on opposite sides of the 16-map mobile atlas page boundary. It revalidates each map pointer and header/layout against current ROM bytes, then groups identical in-ROM object/trigger script targets. Results include exact source pointer offsets, bank/map/event references, counts, and whether a group spans 16-map pages.

Default limits: 64 maps, 4096 pointer fields, 64 groups, 16 references per group. All limits are bounded; exceeding the pointer budget fails closed rather than silently claiming complete coverage. `nextStartMap` indicates unscanned maps. A scan across a subset **cannot** detect aliases shared with maps outside that subset. A target shared by multiple events may be entirely intentional.

This is a source-grounded **core inspection capability**, not yet exposed as a mobile control. It does not dereference target bytes, infer allocation ownership, follow control flow, authenticate CUBE-specific formats, modify ROMs or earn independent parity credit. Genuine ROM/emulator/Android verification remains outstanding.

Source: pinned [CUBHMA map model](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs).
