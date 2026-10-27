# Vanilla warp return-path review

This read-only feature compares a selected map's raw warp destinations with the raw warp record at each recorded arrival index. The record layout is grounded in [pinned CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs).

Classification: reciprocal (arrival warp points to the exact source map and source warp index); differentWarp (points to the source map but a different warp index); differentMap; specialReturn (0xFF return target); unresolved (special, undeclared, invalid or out-of-bounds source arrival). The source and destination pointer sources and layouts are revalidated against current ROM bytes. The inspection is capped to 128 visible records, with full counts across all source warp records.

**Non-reciprocal travel is not necessarily broken.** One-way routes, special warps, scripts and event-dependent transitions can be intentional. The feature does not execute script commands, verify game engine behavior, authenticate CUBE-specific formats or write any bytes.

In the mobile atlas, select a declared map and choose **Review selected map warp return paths**. Tap a source or arrival record to inspect exact ROM bytes. Tests use synthetic ROM fixtures; authentic ROM/emulator and Android-device acceptance are still required.
