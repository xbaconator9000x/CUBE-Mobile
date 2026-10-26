# Roadmap

## Checkpoint v0.5 (26 October 2026)
- [x] Preserve a reproducible v0.5 offline HTML checkpoint.
- [x] Restore editable web modules from the standalone build.
- [x] Private GitHub repository access confirmed.
- [x] GitHub Actions automated unit checks on future pushes.
- [ ] Import the complete original v0.5 browser/unit test suites from the archived ZIP; CI's initial suite is a smoke subset.
- [ ] Import and audit exact upstream CUBHMA dependencies, license notices and test fixtures.

## Watchdog checkpoint — 26 October 2026
- [x] Source-grounded, read-only fixed-length HMA `ArrayRun` field preview (subset only; no writes).
- [x] Reject unsupported/dynamic formats, out-of-ROM tables and invalid pointers.
- [x] Add touch-scrollable row preview, row-to-hex navigation and five additional unit tests.
- [ ] Full ArrayRun format grammar, dynamic lengths, enum/PCS interpretation, table inheritance, typed pointers, occupancy graph and relocation.
- [ ] Migrate full original browser/unit test archive into CI and run Android device tests.

## Milestone 1 — semantic read-only CUBHMA engine
- [ ] Parse HMA metadata and format DSL, beyond named-anchor fields.
- [ ] Recognise ROM game/version and CUBE-specific metadata without false positives.
- [ ] Resolve anchored tables, pointers, runs, compressed images and map structures.
- [ ] Render actual named Pokémon, trainers, images and map data in mobile inspectors.
- [ ] Build realistic fixture/ROM regression corpus, legal provenance documented.

## Milestone 2 — safe semantic editing
- [ ] Managed free-space allocation, repointing and transaction rollback.
- [ ] Tables, text and images with non-destructive copy-on-write.
- [ ] Maps, collision/movement, warps, connections and event scripts.
- [ ] Round-trip/regression gates before exposing write buttons.

## Milestone 3 — feature parity and Android APK
- [ ] Remaining upstream HMA/CUBHMA editors and CUBE extensions.
- [ ] Large-ROM responsiveness, import/export, navigation, persistence and recovery.
- [ ] Android wrapper/APK build, hardware/device testing and emulator validation.
- [ ] Document any unsupported upstream feature precisely before declaring parity.
