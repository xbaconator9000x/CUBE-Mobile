# CUBE explicit warp arrival trace

Resolves a selected CUBE custom warp record against an **explicit** destination-bank map count, then inspects the destination map's raw warp array and coordinates. Reports missing destination maps/warp IDs, special targets, out-of-bounds coordinates and whether the destination's raw record points back to the origin. All reads are bounded; no ROM bytes are changed.

This is **not** proof that the game permits travel, that the destination is walkable, or that the records are compatible with a real CUBE ROM. Target map counts are never guessed; custom ROM/TOML provenance, emulator, Android and save/reopen acceptance remain outstanding.
