# CUBE connection ownership census and mobile review

The bounded cross-bank ownership census now optionally inspects the CUBE
Emerald map connection group (8-byte header) and its fixed-width 12-byte
connection records, using the pinned CUBHMA `MapModel.cs` connection
format and the existing conservative decoder.

Enable **Include connection groups and arrays** alongside event-array coverage
in the mobile/offline ownership explorer. A shared array is reported as an
overlap across maps; a connection group/array that cannot be decoded is
reported as a separate issue without concealing otherwise decoded map slots.

The combined cell/warp/event changed-byte ownership audit now includes
connection claims automatically, so an edited warp/event byte that aliases a
connection record is flagged. Incomplete connection decoding prevents a
positive bounded no-overlap report. Source ROM bytes remain immutable.

This does **not** prove global pointer ownership, valid in-game connections,
safe writes, ROM/TOML authenticity or real-ROM save/reopen. Explicit counts
cover only the banks the user supplies (1–8 banks, 256 maps). No CUBE parity
acceptance is claimed; all export permissions remain disabled.

Pinned source: `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`
`src/HexManiac.Core/Models/Map/MapModel.cs`.
