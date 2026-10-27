# Atlas-wide vanilla script target alias audit

This opt-in core inspector scans every map in an **explicitly declared** RSE/FRLG atlas, instead of treating each 64-map UI window as independent. It detects object and trigger records pointing to the same script offset even when the records are separated by multiple windows.

Source provenance: [pinned CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), using the vanilla map header, layout and event-record structures. Each map pointer and layout is checked against the current ROM accessor before its event script pointers are considered. Invalid/stale pointers or budget overflow fail the entire audit rather than returning a misleading partial-atlas result.

Caps: at most 4096 declared maps, 32768 object/trigger pointer fields by default (hard ceiling 65536), 64 displayed alias groups and 16 displayed references per group. Counts include truncated display records. No ROM bytes are written or exported. A script alias is a structural hint only: scripts may intentionally be shared, and no script allocation extent, control flow or CUBE ownership is authenticated.

The strict CUBHMA/CUBE parity score remains unchanged. Authentic CUBE layout evidence, genuine ROM save/reopen, emulator and Android device testing are still outstanding.
