# Immutable multi-change review

`reviewVanillaChangeSet` accepts bounded, byte-exact proposed changes from the existing vanilla blockmap cell, warp record and object/trigger/signpost preview helpers. It rechecks every original byte against current staged ROM data, rejects overlapping proposals (including duplicates), validates record lengths, caps both record count and total bytes, and returns a sorted, frozen summary.

This is an **in-memory review only**, not a patch writer, semantic editor or transaction. A caller cannot derive write permission from its output. It does not authenticate CUBE layouts, pointer ownership, relocation safety, collision behavior, ROM identity, emulator operation or Android compatibility. Source ROM bytes remain unchanged. Future transactional editing must independently authenticate each of those prerequisites before any semantic write.

## Field-scoped review validation

Queued previews now produce immutable typed field differences (tile ID/raw six-bit collision, warp coordinates/destination, and exposed event coordinates/elevation). The review rejects even a forged preview object if it attempts to change object script pointers, event flags, trigger script pointers, signpost arguments, or other non-editable bytes. This is a validation layer for the **preview queue only**: it does not grant write authority, validate CUBE-specific layouts or guarantee script/runtime safety. The mobile and offline review display original and proposed field values before any future authenticated edit workflow.
