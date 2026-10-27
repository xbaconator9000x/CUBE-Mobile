# Declared vanilla event ownership audit

Source: pinned [kcradi/CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), Format.EventsFormat / ObjectsFormat / WarpsFormat / ScriptsFormat / SignpostsFormat.

`auditVanillaAtlasEventOwnership` re-resolves the entire explicitly counted vanilla RSE/FRLG map atlas against current staged ROM bytes. It inspects event-group pointers and non-empty object, warp, script-trigger and signpost arrays, returning exact shared-span groups and potential partial/cross-kind overlaps. It records the pointer field ROM offsets for each map reference, including duplicate pointers in a shared event group.

Exact aliases are grouped by kind, start and byte length; a different length or kind is not silently treated as the same allocation. Overlap findings use a sorted interval sweep: each distinct span overlapping an earlier span is counted once, rather than claiming to enumerate all overlapping pairs. Result lists are bounded; counts cover the entire declared atlas. Malformed maps, stale bank pointers, invalid event arrays and out-of-ROM data fail closed.

**Not authenticated:** the user-supplied atlas, CUBE layout/version, actual ownership, runtime warp behavior, free space and safe relocation. Shared arrays may be intentional. No bytes are written, no script is executed, and this is not evidence of complete feature parity. Do not authorize editing on the basis of these results.
