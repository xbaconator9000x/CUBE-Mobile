# CUBE custom connection destination trace

The read-only trace resolves one raw CUBE connection against an **explicit** destination-bank map count (1–128), inspects the destination's dimensions and connection records, and lists raw links back to the source. It never guesses dynamic bank counts. Special targets, missing maps, malformed structures and absent backlinks are distinguished.

A backlink is a record match, **not** evidence of geometric alignment, traversal, correct engine direction semantics or safe editing. Pinned source: `kcradi/CUBHMA` at `3044393183e01af2ae1e907fb37e4a75eda6a8dc`, `MapModel.cs` and `cube_emerald.toml`. Real CUBE ROM/metadata authentication, emulator, Android and save/reopen acceptance are outstanding. No ROM bytes are written or included in fixtures.
