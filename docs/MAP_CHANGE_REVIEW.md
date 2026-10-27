# Immutable multi-change review

`reviewVanillaChangeSet` accepts bounded, byte-exact proposed changes from the existing vanilla blockmap cell, warp record and object/trigger/signpost preview helpers. It rechecks every original byte against current staged ROM data, rejects overlapping proposals (including duplicates), validates record lengths, caps both record count and total bytes, and returns a sorted, frozen summary.

This is an **in-memory review only**, not a patch writer, semantic editor or transaction. A caller cannot derive write permission from its output. It does not authenticate CUBE layouts, pointer ownership, relocation safety, collision behavior, ROM identity, emulator operation or Android compatibility. Source ROM bytes remain unchanged. Future transactional editing must independently authenticate each of those prerequisites before any semantic write.
