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

## Watchdog checkpoint — offset pointers (26 October 2026)
- [x] Read-only parse `[[OffsetPointer]]` TOML records with signed 32-bit displacements and strict bounds.
- [x] Inspect adjusted pointer references as upstream `PokemonModel.ReadPointer` does (stored GBA pointer minus Offset).
- [x] Reject contradictory offset declarations across metadata files; preserve active metadata on parse failure.
- [x] Prioritize explicitly declared offset pointers over generic table/raw interpretations at the same source.
- [ ] Full CUBHMA pointer ownership graph, dynamic tables, code pointers and safe repointing remain blocked on semantic completeness and ROM fingerprints.

## Watchdog checkpoint — anchored table lengths and overlap witnesses (26 October 2026)
- [x] Resolve exact-name `ArrayRun.LengthFromAnchor` dependencies when the parent is a uniquely declared, supported, fully bounded table; forward references and chains supported without recursion.
- [x] Detect cyclic/missing/unresolved parents, duplicate-name contradictions, out-of-ROM tables and overlapping resolved table spans (bounded overlap witnesses).
- [x] Preview supported linked-length tables read-only and include their typed pointer fields in cross-reference inspection; suppress typed interpretations for overlapping table claims.
- [x] Add synthetic regression tests for dependency chains, conflicts, bounds, overlap and ROM immutability.
- [ ] Upstream parent-length margins, dynamic/streaming table lengths, constants, enum/PCS/tuple/record grammar, authentic ROM fingerprints and full formatted-run ownership remain unsupported.
- [ ] Audit overlapping ROM-native structures and editor interoperability before semantic writes.

## Watchdog checkpoint — bounded ParentOffset and metadata conflicts (26 October 2026)
- [x] Parse CUBHMA `ParentOffset` one-sided and two-sided signed decimal margins, resolve parent count + beginning + end with strict positive/size/bounds checks.
- [x] Propagate adjusted table lengths through forward/chained dependencies; surface margin provenance in the read-only mobile inspector and pointer-source inspection.
- [x] Preserve conflicting `[[NamedAnchors]]` declarations across imported TOMLs; do not silently overwrite incompatible offsets or formats. Exclude contradictory names from typed inspection.
- [x] Add synthetic tests for margins, invalid counts, chained lengths, ROM immutability and contradictory metadata.
- [ ] Implement CUBHMA's authenticated metadata overlay precedence, list/constant-derived counts, full grammar and ROM-version fingerprinting.
- [ ] Complete formatted-run ownership and editor interoperability before any semantic write or relocation.

## Watchdog checkpoint — HMA named lists (26 October 2026)
- [x] Parse bounded `[[List]]` metadata with multiline, inline, single-entry and sparse indexed entries, preserving list cardinality.
- [x] Resolve read-only table lengths from named-list counts with ParentOffset margins and chained table dependencies; named anchors take precedence.
- [x] Fail closed on conflicting list declarations, invalid formats, unsupported list syntax, invalid adjusted lengths, overlaps and out-of-ROM tables.
- [x] Include supported list-length tables in pointer inspection and mobile preview, with read-only provenance; add synthetic regression tests.
- [ ] Implement ROM-backed `[[MatchedWords]]`/`WordRun` constant-derived counts and validate precedence/overlay against upstream.
- [ ] Full CUBHMA metadata grammar, nested records, ROM-authenticated ownership, safe writes and Android device acceptance remain outstanding.

## Watchdog checkpoint — ROM-backed MatchedWords (26 October 2026)
- [x] Parse bounded `[[MatchedWords]]` declarations (1/2/4-byte sources, signed offsets, positive multipliers, optional notes) and retain all source locations per name.
- [x] Read values from the active staged ROM, require agreement across all sources, reject conflicting source claims, out-of-ROM reads, fractional values and ambiguous offset/multiplier arithmetic.
- [x] Resolve matched-word-derived table lengths and chained ParentOffset dependencies, with named anchors and lists retaining precedence; suppress typed previews when WordRun source spans collide with table spans.
- [x] Surface ROM-backed provenance, refresh counts after staged byte edits, clear metadata after applying a patch, and add synthetic ROM immutability/undo tests.
- [ ] Verify upstream CUBHMA's divergent `WordRun.Read` vs `ArrayRun.ParseLengthFromAnchor` offset/multiplier arithmetic on real licensed fixtures before relaxing conservative rejection.
- [ ] Implement authenticated metadata overlay, full run ownership, nested grammar, safe writes, ROM/emulator and Android device tests.

## Watchdog checkpoint — conservative run byte-claim collisions (26 October 2026)
- [x] Index supported table spans, all MatchedWords source bytes (including unresolved words), and explicit OffsetPointer source spans using bounded prefix-max interval lookups.
- [x] Reject scalar/partial/cross-row OffsetPointer overlays, offset/offset overlaps and word/offset overlaps; allow exact complete pointer-field overlays only.
- [x] Suppress typed pointer results for unsafe OffsetPointer sources and propagate conflicting WordRun sources through dependent table lengths.
- [x] Add synthetic regressions for multiple word sources, overlapping offset sources, adjacent tables, immutable ROM bytes and a 2,000-table scan.
- [ ] Full upstream run ownership including dynamic/nested tables, code/script pointers, alias resolution, relocation and authenticated metadata overlays.
- [ ] On-device performance, native map/collision/warp and editor interoperability tests before semantic writes.

## Watchdog checkpoint — unresolved named-anchor byte claims (27 October 2026)
- [x] Add conservative read-only collision suppression when an unresolved named anchor starts inside a supported table; propagate conflict to dependent tables and explicit offset-pointer sources.
- [x] Add generated-ROM regressions for colliding unresolved anchors, dependent tables, disjoint unknown anchors and same-start unknown formats.
- [ ] Treat unknown run extents as **unknown**, not free space; this one-byte witness is a lower bound, not a full ownership graph.
- [ ] Verify legitimate upstream aliases and nested formats against licensed fixtures before relaxing conservative read-only suppression.
- [ ] No semantic writes, repointing or allocation until full upstream ownership and ROM fingerprint gates pass.

## Watchdog checkpoint — bounded text-byte UI inspection (27 October 2026)
- [x] Add bounded, immutable fixed-width ROM text-byte inspection with explicit `0xFF` termination and ASCII-only hints (not PCS).
- [x] Show termination status on supported, non-conflicted fixed-table text cells in the mobile UI and bundle the module in the offline build.
- [x] Add synthetic regressions for zero-offset and nonzero-offset termination, invalid readers, and ROM immutability.
- [ ] Verify actual upstream PCS mappings and CUBE-specific text encodings using legal fixtures; decode only after version and format checks.
- [ ] Implement semantic ownership, authentic game fixtures, mobile device acceptance and non-destructive text editing before claiming parity.

## Watchdog checkpoint — source-grounded Gen 3 PCS fallback (27 October 2026)
- [x] Port upstream `PCSString.GetDefaultPCS` character table and default control-code lengths into a bounded, immutable, **read-only** JavaScript decoder.
- [x] Restrict preview to known Gen 3 game codes with valid header checks; label it unauthenticated even when displayed, because CUBE/custom ROMs can override text mappings.
- [x] Handle escaped `0xFF` as control payload rather than a false string terminator, detect truncated escapes and visibly escape unknown glyphs.
- [x] Integrate a guarded default-PCS preview into resolved, non-conflicted mobile table text fields; preserve raw bytes and ASCII hints, update offline bundling and synthetic tests.
- [ ] Verify actual upstream `resources/pcsReference.txt` overrides, per-game macros and CUBE-specific text mappings against licensed fixtures; add independent cross-language parity tests.
- [ ] Complete ROM fingerprinting, semantic run ownership, non-destructive text edit transactions, emulator roundtrips and Android acceptance before permitting writes.

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

## Watchdog checkpoint — imported PCS reference grammar (27 October 2026)
- [x] Add bounded, read-only parser for upstream-style `0xXX` glyph ranges, `CC_XX` control lengths and game-scoped `[macro]` bytes.
- [x] Decode with explicit imported reference and game code; never consume bytes beyond selected field or mutate staged ROM data.
- [x] Add synthetic regression tests for game-specific macros, control escapes, FF termination, malformed declarations, bounds and unknown bytes.
- [ ] Verify authentic `pcsReference.txt` resource, precedence, macro ordering and CUBE-specific variants against upstream and licensed fixtures.
- [x] Wire optional local reference import into mobile UI and standalone build with provenance warnings; no semantic writes/repointing enabled.
- [ ] Verify the optional reference workflow on real Android devices, including file picker cancellation, offline operation and memory limits.


## Watchdog checkpoint — authentic upstream PCS reference fixture (27 October 2026)
- [x] Pin original `pcsReference.txt` from CUBHMA commit `30443931` as a **test-only** fixture with MIT licence and provenance.
- [x] Parse upstream's underscore-separated game scopes (`@!game(BPRE_BPGE)`, `@!game(AXVE_AXPE)`) without guessing or applying wrong-game colour macros.
- [x] Preserve upstream's literal single-quote-mark glyph declaration (`0xFF = "`) while still rejecting malformed multi-character quoted ranges.
- [x] Add authentic fixture regression tests for glyphs, control lengths, colour macros, read-only decoding and ROM immutability.
- [ ] Validate all upstream macro alias precedence and custom CUBE text extensions before text writes.
- [ ] Run Android hardware import/cancellation/offline/large-file checks; reference imports remain unauthenticated and read-only.

