# Roadmap

## Checkpoint v0.5 (26 October 2026)
- [x] Preserve a reproducible v0.5 offline HTML checkpoint.
- [x] Restore editable web modules from the standalone build.
- [x] Private GitHub repository access confirmed.
- [x] GitHub Actions automated unit checks on future pushes.
- [x] Restore ten high-value original v0.5 binary safety regression cases (IPS/BPS CRC, boundaries, LZ10, sidecar atomicity).
- [ ] Import the remaining original browser/unit test cases from the archived ZIP; CI's initial suite was a smoke subset.
- [ ] Import and audit exact upstream CUBHMA dependencies, license notices and test fixtures.

## Watchdog checkpoint — version-aware metadata (26 October 2026)
- [x] Exact game/revision stock metadata resolver for US Emerald/FireRed/LeafGreen and supported Ruby/Sapphire revisions.
- [x] Refuse unknown revisions, invalid GBA headers and known cross-family stock metadata imports; allow clearly unverified custom TOML.
- [ ] Verify CUBE-specific ROM signatures and version fingerprints independently; a valid header is not proof of stock ROM layout.
- [ ] Build semantic pointer ownership graph, dynamic table grammar and safe format inheritance.

## Watchdog checkpoint — 26 October 2026
- [x] Source-grounded, read-only fixed-length HMA `ArrayRun` field preview (subset only; no writes).
- [x] Reject unsupported/dynamic formats, out-of-ROM tables and invalid pointers.
- [x] Add touch-scrollable row preview, row-to-hex navigation and five additional unit tests.
- [ ] Full ArrayRun format grammar, dynamic lengths, enum/PCS interpretation, table inheritance, typed pointers, occupancy graph and relocation.
- [ ] Migrate full original browser/unit test archive into CI and run Android device tests.

## Watchdog checkpoint — pointer cross-references (26 October 2026)
- [x] Bounded source-location inspection for supported fixed-table pointer fields, including row/field provenance.
- [x] Separate typed-table matches from unverified aligned byte-pattern candidates; never infer ownership from candidate matches.
- [x] Opt-in mobile cross-reference viewer and source-offset navigation with scan caps and explicit partial coverage.
- [ ] Full pointer ownership across nested/dynamic tables, offset pointers, code references, overlaps and relocations.
- [ ] Benchmark large expanded ROMs on Android hardware; make scans incremental and cancellable.

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
