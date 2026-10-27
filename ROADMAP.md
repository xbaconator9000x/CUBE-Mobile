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

## Watchdog checkpoint — explicit vanilla bank/warp inspection (27 October 2026)
- [x] Follow a manually supplied vanilla bank pointer-table address and explicit bank/map counts to a bounded map header/layout; preserve source offsets and reject pointer-array overlaps.
- [x] Inspect vanilla event counts and bounded 8-byte warp records read-only, with tap-to-hex mobile navigation and staged ROM support.
- [x] Add synthetic RSE/FRLG, malformed-pointer, collision, immutability and offline integration regressions.
- [ ] Authenticate CUBE map-bank layouts, discover real metadata-derived counts, resolve warp targets, inspect other events and render actual tiles.
- [ ] No safe semantic map/collision/warp writes or Android device acceptance until version, ownership and roundtrip gates pass.

## Watchdog checkpoint — vanilla map connections (27 October 2026)
- [x] Inspect bounded vanilla map connection headers and 12-byte records, preserving signed displacement and raw target IDs.
- [x] Add mobile and offline connection list with tap-to-hex navigation and staged ROM support.
- [x] Test bounds, overlaps, empty/null arrays, signed values and ROM immutability.
- [ ] Authenticate target maps, connection directions and CUBE-specific structures; render actual maps and implement safe writes only after acceptance gates.

## Watchdog checkpoint — touch map viewport and warp hints (27 October 2026)
- [x] Pan bounded raw blockmap viewport using touch buttons with edge clipping.
- [x] Annotate matching inspected vanilla blockmap cells with raw warp indices, suppress off-map markers and clear stale overlays after ROM/edit changes.
- [x] Add pure viewport/marker and mobile/offline integration regressions.
- [ ] Actual tileset rendering, verified event placement, authenticated CUBE layouts, collision edits and Android hardware acceptance remain outstanding.

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
- [x] Verify upstream `PCSString.FindMacro` uses first-declared matching macro; preserve source order for alias spellings and prefix collisions, with authentic-fixture regression tests.
- [ ] Validate custom CUBE text extensions and complete macro behavior across all supported ROM families before text writes.
- [ ] Run Android hardware import/cancellation/offline/large-file checks; reference imports remain unauthenticated and read-only.


## Watchdog checkpoint — unknown-anchor cross-claim safety (27 October 2026)
- [x] Treat unresolved named-anchor start bytes as minimum occupied claims against **all** supported typed claims: fixed tables, ROM-backed MatchedWords sources and explicit OffsetPointer sources, including sources outside tables.
- [x] Propagate unknown/WordRun collisions to matched-word-derived and chained tables; suppress affected offset-pointer inspection. Preserve half-open end boundaries and original ROM bytes.
- [x] Use sorted unknown starts and binary searches for bounded, non-quadratic collision audits; add synthetic multi-claim and boundary regressions.
- [ ] Unknown run **extent** is still unknown; a one-byte witness cannot prove independent free space, authenticated ownership, or safe repointing.
- [ ] Verify real upstream aliases and dynamic run grammar, CUBE-specific ROM fingerprints, emulator/Android roundtrips before semantic writes.

## Watchdog checkpoint — named-list enum hints (27 October 2026)
- [x] Preserve supported HMA scalar enum-name suffixes in read-only fixed table layouts (including hexadecimal display suffix).
- [x] Display named-list labels alongside, never instead of, the original unsigned ROM value; suppress conflicting, sparse, out-of-range and anchor-shadowed labels.
- [x] Add generated-ROM immutability, parser, metadata-conflict and bounds regression tests; synchronize offline HTML.
- [ ] Upstream enum options can also come from other tables, have offsets, duplicate disambiguation and dynamic data; these are **not** interpreted or edited.
- [ ] Authentic ROM fingerprinting, safe semantic writes, map/collision/warp editors, Android hardware testing and CUBE-specific formats remain incomplete.

## Watchdog checkpoint — upstream CUBE expansion metadata guard (27 October 2026)
- [x] Inspect pinned upstream `StoredMetadata.cs`: `MetadataLayout = '''expansion'''` and named-anchor trainer-party `tpte` formats protect pokeemerald-expansion layouts from vanilla metadata upgrades.
- [x] Detect those TOML markers read-only, including legacy unmarked `tpte` layouts; reject vanilla stock TOML overlays on expansion/custom metadata even with a valid Emerald header.
- [x] Reject contradictory explicit layout declarations, preserve imported layout evidence in the mobile inspector, and add synthetic ROM immutability/regression tests.
- [ ] **ROM fingerprinting is not done**: a valid stock game code or user-supplied TOML marker cannot prove a ROM is CUBE or that a particular table layout matches its bytes.
- [ ] Implement authenticated CUBE version/layout signatures, upstream metadata overlay precedence and full run ownership before any semantic writes or relocation.

## Watchdog checkpoint — exact-byte ROM SHA-256 identity (27 October 2026)
- [x] Add a bounded, streaming SHA-256 implementation with NIST and independent Node crypto parity vectors, including block/padding boundaries.
- [x] Hash stable captured base plus staged edits without copying the entire ROM; preserve source ROM, detect edits/patch changes while hashing, support cancellation and progress.
- [x] Add an opt-in mobile workspace fingerprint action, standalone bundling and regression checks. Do not claim a digest alone authenticates ROM family/layout.
- [ ] Acquire legally distributable, independently verified CUBE version/layout fingerprints and explicit metadata compatibility manifests; no ROM images or unverifiable hashes committed.
- [ ] Validate CUBE/stock fingerprints against licensed fixtures, verify 128 MiB performance on Android hardware, and gate semantic metadata interpretation/writes by trusted version/layout evidence.


## Watchdog checkpoint — exact ROM compatibility comparison (27 October 2026)
- [x] Add an opt-in exact SHA-256 comparison against a separately obtained expected digest, with explicit match/mismatch and no layout-authentication claims.
- [x] Add a strictly validated curated-profile registry interface requiring exact ROM digest/length, game code/revision, layout, metadata digest and source provenance. Leave the bundled registry empty until verified evidence exists.
- [x] Fail closed on duplicate/malformed registry entries, stale fingerprints, header/profile conflicts and mismatching expected hashes; no semantic write permissions.
- [x] Add synthetic ROM immutability, invalid-provenance, mobile integration and standalone-build regressions.
- [ ] Obtain independently verified CUBE ROM and matching TOML SHA-256 digests with licensed provenance; do not invent or copy commercial ROM bytes.
- [ ] Verify exact metadata bytes against curated metadata hashes and run authentic ROM/emulator and Android-device compatibility tests before trusting any layout.

## Watchdog checkpoint — exact TOML byte identity (27 October 2026)
- [x] Add bounded, exact-byte per-file SHA-256 hashing without text normalisation or ROM mutation.
- [x] Bind a **single** metadata digest to a matching full-ROM profile, with explicit missing/multi-file/mismatch/stale outcomes and no write authority.
- [x] Add regression coverage for UTF-8 BOM, CRLF, mismatches, stale ROMs, unverified profiles and multi-file overlays.
- [x] Integrate raw-file hashing with atomic TOML imports, stale-ROM/import cancellation and mobile/standalone status UI (read-only; hashes only, not metadata authentication).
- [ ] Validate the file-picker, network cancellation, 16 MiB aggregate limits and offline flow on Android hardware.
- [ ] Add authenticated multi-file manifest support for upstream common + game-specific TOML overlays; verify independent CUBE build fingerprints.
- [ ] Complete semantic ownership, map/collision/warp roundtrip and emulator/Android acceptance before enabling writes.

## Watchdog checkpoint — source-grounded blockmap cell inspection (27 October 2026)
- [x] Implement read-only 16-bit blockmap cell decoding matching upstream `BlockCells` (`tile = word & 0x3FF`, `collision = word >> 10`).
- [x] Preserve all six high bits rather than assuming they are a walkability flag; expose exact row-major ROM offsets and bounded viewports.
- [x] Reject unverified offsets, unaligned starts, out-of-ROM full maps and oversized dimensions; verify ROM immutability with synthetic tests.
- [ ] Connect to authenticated map-bank/layout pointers and named metadata; implement mobile blockmap preview, rendering, event/warp overlays and editor roundtrips.
- [ ] Independently verify CUBE layout variants and map collision semantics before any write operation.

## Watchdog checkpoint — mobile blockmap viewport (27 October 2026)
- [x] Add read-only Blockmaps tab and workspace card with manual ROM offset/dimensions, 12×10 bounded cell preview, raw collision/elevation values and tap-to-hex navigation.
- [x] Read current staged ROM bytes through a bounded accessor rather than copying up to 128 MiB; reject malformed map layouts and invalid bytes.
- [x] Bundle in offline HTML and add mobile/offline wiring and staged-read regression tests.
- [ ] Authenticated map-bank/header/layout discovery, tile graphics, collision semantics, warps/events, save-roundtrip, CUBE layouts and Android hardware validation remain unfinished.

## Watchdog checkpoint — vanilla map header/layout resolution (27 October 2026)
- [x] Source-grounded, bounded read-only vanilla RSE/FRLG map layout and header pointer interpretation from explicitly supplied ROM offsets.
- [x] Mobile/offline Blockmaps UI resolves layout dimensions and blockmap pointer without copying or writing ROM bytes; staged reads supported.
- [x] Add synthetic pointer/bounds/overlap/immutability tests and UI/offline parity assertions.
- [ ] Authenticate CUBE/expansion layout grammar and bank pointers from exact ROM + TOML metadata; vanilla structures are NOT a safe fallback for expansion layouts.
- [ ] Render actual map graphics, inspect warps/events, test on Android and validate roundtrip before structured writes.
