# CUBE map-script table inspection

The pinned upstream [CUBHMA MapModel.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs) declares `mapscripts<[type. pointer<>]!00>`. The [MapScriptCollection](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/ViewModels/Map/MapScriptCollection.cs) reads five-byte entries until type 0, and treats types **2 and 4** as pointers to conditional tables of eight-byte records `variable:u16, value:u16, scriptPointer:u32`, terminated by variable 0 or 0xFFFF. Other supported types 1–7 point directly to scripts.

`inspectHmaCubeMapScripts` decodes the bounded list and conditional table entries without executing or disassembling script instructions. It rejects invalid pointers, unknown types, missing terminators, self-overlaps with the map script list, and overlaps with known local map structures. Limits are explicit (up to 64 entries and 64 conditions per table). It does not claim global ownership or valid script semantics.

This is read-only source-grounded CUBE structural decoding, **not** an independently authenticated ROM/TOML compatibility result, full script editor, safe ROM save/reopen or strict parity evidence. Do not commit copyrighted ROM assets.
