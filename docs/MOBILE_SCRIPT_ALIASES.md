# Mobile shared vanilla event-script target explorer

The Blockmaps atlas now offers **Review shared script targets (next 16 maps)** after the user supplies an explicit vanilla RSE/FRLG map-bank pointer table and counts. Each bounded page inspects up to 16 declared maps for object/trigger script fields pointing to an identical conventional in-ROM offset. It displays each target, source bank/map/event record and exact pointer-field byte offset.

Touch controls inspect the raw target or individual pointer bytes. Before navigation, the app checks that the ROM and declared atlas inputs still match and re-runs the same bounded page audit, rejecting stale source pointers or changed target groups. Results are paginated, capped at 32 groups and 8 references per group; the scanner retains total counts even when results truncate. The offline standalone HTML includes the same workflow.

**Limitations:** Aliases spanning two separate pages are not detected. A shared target is not proof of allocation ownership, script grammar, safe repointing or a defect. The UI never edits, executes or follows scripts, does not authenticate CUBE layouts, and earns no strict parity credit. Genuine ROM save/reopen, emulator and Android hardware verification remain outstanding.

Format provenance: pinned [CUBHMA map/event structures](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs) and the existing declared vanilla atlas.
