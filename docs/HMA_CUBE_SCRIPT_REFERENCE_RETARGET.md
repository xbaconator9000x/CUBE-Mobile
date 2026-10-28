# CUBE Emerald script-reference retargeting (copy-only)

Pinned source: [CUBHMA MapModel.cs at 3044393183e01af2ae1e907fb37e4a75eda6a8dc](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Map/MapModel.cs), specifically `ObjectsFormat`, `ScriptsFormat`, `SignpostsFormat`, `SignpostEventModel.HasScript` and `HiddenItemEncoding`.

The CUBE Emerald event layout exposes 32-bit script references at object-record offset 16 and script-trigger offset 12. Signpost record offset 8 is a **union**: kinds 0–4 refer to scripts, while kinds 5–7 encode hidden items; unknown kinds are not assumed to be scripts. Treating all signpost arguments as pointers corrupts hidden-item data.

`inspectHmaCubeScriptReferences` inventories these references without reading script instructions. `previewHmaCubeScriptRetargetBatch` can plan up to 32 distinct script-reference changes, but only by copying an existing, in-ROM, non-local-structure pointer from another eligible event on the **same selected map**. Expected source words are mandatory. Every event array is re-decoded and unrelated fields are checked. `verifyHmaCubeScriptRetargetDryRun` applies to a private ROM snapshot, re-decodes, counts changed bytes and restores the original, checking the source again.

**Not yet implemented:** script instruction parsing/compilation, user-facing editor controls, script pointer alias/ownership closure, actual ROM export, emulator/Android tests or independent CUBE ROM/TOML authentication. An in-ROM pointer is not proof of valid script instructions. This module deliberately returns no ROM bytes and never authorizes writing; strict parity remains 0/30. Do not commit copyrighted ROM data or personal input files.
