# CUBHMA → CUBE Mobile: full-port plan

## Source of truth
- Upstream: [kcradi/CUBHMA](https://github.com/kcradi/CUBHMA), desktop release described as v0.7.2.
- Inspected source revision during initial planning: `3044393183e01af2ae1e907fb37e4a75eda6a8dc` (16 October 2026).
- Target: Android-first mobile web experience, eventually packaged as an APK. Maintain compatibility with the precise original HMA/CUBHMA metadata and supported ROM formats.
- License/provenance: upstream MIT; preserve copyright notices and distinguish custom work.

## Architecture
1. Inventory upstream C#/.NET 6 source and its `HexManiac.Core`, `HexManiac.Integration`, WPF and test project boundaries. Track upstream commits.
2. Reuse or faithfully port the **semantic ROM model**, metadata DSL, managed pointers, free-space allocator, compression/decompression and model transactions. The v0.5 TOML anchor search is only a read-only precursor.
3. Define a versioned internal ROM project: immutable original plus structured edits and references, collision/layer/movement/event semantics, checksums, migration and rollback.
4. Build touch-first UI for each full desktop editor: Pokémon, trainers, items, moves, movesets, evolution, maps, tiles, collision/movement, warps, events, NPC/OW sprites, image/palette, animation, scripts, text, music/cries, Pokédex, constants, intros, customization and CUBE configuration.
5. For CUBE ROMs, support engine-specific layouts, tables, toggle scripts and safe upgrades only after verified compatibility matching. Unknown or modified versions must fail safely.
6. Package for Android after browser editing is fully tested; Android Back, Storage Access Framework, device lifecycle, large-ROM memory and autosave/restore must get on-device validation.

## Release gates — none may be assumed passed
- Metadata and ROM identification by version/CRC or equivalent robust signatures, not header alone.
- Round-trip decode → edit → save → reopen → compare for each editor.
- Dependency/pointer relocation and shared data copy-on-write invariants.
- Preserve native metatile layers, collision, behaviour bytes, permissions and map connections.
- No ROM write on unsupported format, ambiguous pointer layout or unknown CUBE version.
- User-visible transaction history, non-destructive Save As and recovery.
- Unit, fixture, emulator/runtime, and cross-editor interoperability tests.
- Accessibility, touch hit targets, mobile scrolling and Android Back behaviour.

## Completed as of v0.5
- Standalone touch-oriented byte workbench and read-only named-anchor TOML inspection.
- Browser hash-navigation for Android Back.
- GBA LZ10 graphics scanning and bounded decoding (not sprite semantics).
- Safe staged raw edits and some patch correctness tests using synthetic ROM data.
- Reconstructable modular source and private GitHub checkpoint.

## Not completed
All full-port gates above; complete upstream .NET semantic engine, native map/collision/event/script/sprite/music/Pokémon editors, CUBE update/migration, and full Android APK.
