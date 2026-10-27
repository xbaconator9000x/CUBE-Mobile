## Checkpoint — atlas-wide shared vanilla script targets (28 October 2026)
- [x] Audit all explicitly declared vanilla maps in a single capped, fail-closed pass, including aliases separated by arbitrary 64-map scan windows.
- [x] Preserve exact event pointer-field provenance, count all references while capping displayed groups, and reject stale map pointers/layouts and oversized audits.
- [x] Add synthetic regression coverage; no ROM writes, CUBE ownership authentication or strict parity credit. See [atlas-wide script aliases](docs/VANILLA_SCRIPT_ALIAS_ATLAS.md).
- [x] Add touch-friendly full-atlas scan, exact source/target navigation, stale-finding revalidation, and offline HTML with regression tests.
- [ ] Independently verify genuine CUBE ROM, emulator and Android acceptance.

# Roadmap

## Checkpoint — mobile vanilla map script summary (28 October 2026)
- [x] Show bounded object/trigger script pointer statuses, decoded-prefix stop reasons, branch counts and typed operand counts per selected vanilla map.
- [x] Revalidate selected map and raw pointer findings before navigation; include modular/offline UI and tests.
- [ ] CUBE grammar, script ownership, safe writes and genuine ROM/emulator/Android acceptance remain unverified. See [mobile map script audit](docs/MOBILE_MAP_SCRIPT_AUDIT.md).

## Checkpoint — mobile cross-page vanilla script aliases (28 October 2026)
- [x] Show bounded 64-map shared script-target scans across 16-map UI page boundaries, with exact source/target hex navigation.
- [x] Revalidate declared atlas inputs and raw pointer findings before navigation; include offline HTML and tests.
- [ ] Cross-64-map-window aliases, CUBE ownership, safe writes and genuine ROM/emulator/Android acceptance remain unverified. See [mobile cross-page aliases](docs/MOBILE_SCRIPT_ALIAS_CROSSPAGE.md).

## Checkpoint — mobile shared event-script targets (28 October 2026)
- [x] Page through 16 explicitly declared vanilla maps for exact shared object/trigger script targets and source pointer offsets.
- [x] Revalidate atlas inputs and each finding before raw hex navigation; support modular/offline mobile UI and synthetic regressions.
- [ ] Cross-page alias coverage, authenticated CUBE script ownership, safe repointing, genuine ROM/emulator/Android acceptance remain outstanding. See [mobile alias explorer](docs/MOBILE_SCRIPT_ALIASES.md).

## Checkpoint — mobile vanilla script operand role review (28 October 2026)
- [x] Display bounded pointer-role hints from selected vanilla object/trigger scripts, with exact source and in-ROM target navigation.
- [x] Revalidate selected event pointer and decoded operand bytes before navigation; include standalone offline build and regression tests.
- [ ] No CUBE script ownership, authentic ROM/emulator/Android acceptance or semantic writing permission. See [mobile operand review](docs/MOBILE_SCRIPT_OPERAND_POINTERS.md).

## Checkpoint — conservative vanilla trainerbattle subtype parsing (28 October 2026)
- [x] Decode upstream-defined trainerbattle subtypes 00–08 with exact operand widths, byte budgets and bounded raw pointer inspection.
- [x] Stop on subtype 09+ or incomplete commands without guessing game-specific extensions; cover FRLG/RSE and pointer role summaries with synthetic tests.
- [ ] Authenticate CUBE-specific battle script grammar and genuine ROM/emulator/Android acceptance before semantic edits or parity credit. See [trainerbattle checkpoint](docs/VANILLA_TRAINERBATTLE_SUBTYPES.md).

## Checkpoint — vanilla script operand pointer hints (28 October 2026)
- [x] Classify fixed-width command pointer operands as branch, generic data, ASM/code, movement or message hints with exact ROM provenance and capped output.
- [x] Aggregate statuses in map event-script audits and expose counts only in SHA-256-checked local-ROM smoke reports; add synthetic tests.
- [ ] Independently authenticate CUBE target formats and test genuine ROM/emulator/Android acceptance. No write authorization or strict parity credit. See [operand pointer hints](docs/VANILLA_SCRIPT_OPERAND_POINTERS.md).

## Checkpoint — shared vanilla event-script target hints (28 October 2026)
- [x] Scan up to 32 explicitly declared vanilla maps per page for object/trigger script pointers sharing the same in-ROM destination.
- [x] Revalidate source bank pointers and header/layout provenance, cap alias groups and reference lists, preserve exact pointer-field offsets.
- [x] Add synthetic shared-target, page-boundary and stale-pointer regression tests. See [script aliases](docs/VANILLA_SCRIPT_ALIASES.md).
- [ ] This is not proof of allocation ownership or CUBE script compatibility; genuine ROM/emulator/Android acceptance and safe shared-data transactions remain outstanding.


## Checkpoint — bounded local event-script smoke (28 October 2026)
- [x] Add a capped read-only object/trigger script-prefix and branch-status audit for explicit vanilla map headers; no control-flow traversal or script ownership inference.
- [x] Integrate bounded per-map script pointer and decoder-status counts into the opt-in, SHA-256-matched local ROM smoke report without exporting ROM bytes.
- [x] Test synthetic valid/invalid pointer structures, script decode and non-mutating output.
- [ ] Independently authenticate CUBE script layouts and test real-ROM/emulator/Android acceptance; strict parity remains unchanged. See [local script audit](docs/LOCAL_SCRIPT_AUDIT.md).


## Checkpoint — local authentic-ROM acceptance groundwork (28 October 2026)
- [x] Add an opt-in, local-only CLI for independently supplied SHA-256 and explicit vanilla map declarations, with read-only atlas, event and pointer alias summaries.
- [x] Reject mismatched hashes and malformed declarations; test against ephemeral synthetic ROM bytes without committing ROM fixtures. See [local map smoke](docs/LOCAL_MAP_SMOKE.md).
- [ ] Obtain independently vetted CUBE ROM/layout declarations and run genuine save/reopen, emulator and Android hardware acceptance before awarding any strict parity credit.


## Checkpoint — read-only vanilla script branch review (28 October 2026)
- [x] Classify decoded vanilla call/goto/conditional script pointer operands as known command starts, mid-command hints, unresolved outside-prefix, null, non-ROM or out-of-ROM, with exact source offsets and bounded output.
- [x] Preserve no-follow/no-write behavior and synthetic regression coverage; [branch audit details](docs/VANILLA_SCRIPT_BRANCH_AUDIT.md).
- [x] Add touch-friendly branch findings with exact source/target hex navigation and standalone offline integration tests.
- [ ] Authenticate CUBE script grammar and real-ROM/emulator/Android behavior before any semantic edits or parity credit.


## Checkpoint — conservative vanilla event-script prefix (28 October 2026)
- [x] Decode a bounded subset of fixed-width vanilla RSE/FRLG event commands using pinned upstream CUBHMA signatures, with raw offsets, arguments and pointer statuses.
- [x] Stop on unknown opcodes, incomplete commands and terminal instructions without following control flow; test malformed inputs and accessor safety.
- [x] Integrate a touch-friendly command list and offline HTML with tap-to-hex source offsets, stale map/ROM selection checks and synthetic integration tests.
- [ ] Authenticate CUBE-specific grammar, genuine script ownership and ROM/emulator/Android acceptance. No semantic writes or strict parity change. See [script prefix](docs/VANILLA_SCRIPT_PREFIX.md).


## Checkpoint — queued map visual previews (27 October 2026)
- [x] Validate up to 64 proposed vanilla blockmap cells together; recheck original ROM bytes, reject overlap and forged map provenance, and render a bounded before/after viewport without writes.
- [x] Add a stale-checked read-only staged ROM accessor for reviewed blockmap, warp and event changes.
- [x] Add a touch-friendly queued comparison to modular and offline applications, with raw high-bit changes distinguished from visual changes.
- [x] Cover synthetic composed edits, stale inputs, bounds, queue wiring and offline script syntax.
- [ ] Authenticate CUBE-specific layouts, independently verify ROM/emulator/Android acceptance, then design safe transactional editing and rollback. See [queued comparison](docs/MAP_QUEUED_VISUAL_COMPARISON.md).

## Checkpoint — raw map colour inspection and visual edit comparisons (27 October 2026)
- [x] Revalidate vanilla blockmap preview provenance and original bytes, then render bounded side-by-side before/after metatile images through a read-only two-byte accessor overlay.
- [x] Show changed pixel counts and bounds, distinguish nonvisual raw high-bit changes, and keep ROM bytes immutable.
- [x] Colour-code raw six-bit blockmap values, metatile behavior bytes and FRLG-only terrain/encounter attributes in the rendered map, with legends and existing warp/event markers preserved.
- [x] Provide a matching raw high-bit colour legend and optional cell-grid borders even without metatile graphics.
- [x] Test synthetic invariants, stale previews, UI wiring and standalone offline parity. See [visual diff](docs/MAP_VISUAL_DIFF.md) and [raw overlays](docs/MAP_RAW_OVERLAY.md).
- [ ] Authenticate real CUBE map grammar, blocksets and metadata; test genuine ROM/emulator/Android workflows before claiming semantic editing or full feature parity.
- [ ] Extend read-only multi-cell comparison to queued map proposals, then implement validated save/reopen transactions with rollback and verified pointer ownership.


## Checkpoint — queued immutable map change review (27 October 2026)
- [x] Queue up to 64 byte-exact blockmap, warp and object/trigger/signpost previews in the touch-friendly map UI and inspect a sorted combined review.
- [x] Reject stale source bytes, overlapping or duplicate ROM ranges and excessive byte budgets before queueing or reviewing; clear on ROM replacement and metadata reset; include offline UI and tests.
- [ ] No apply/export permission. Authenticate CUBE version/layout, pointer ownership, relocation and rollback, then independently verify authentic ROM/emulator/Android save roundtrips before enabling semantic writes. Strict parity unchanged.


## Checkpoint — touch-friendly object, trigger and signpost coordinate previews (27 October 2026)
- [x] Select inspected vanilla object/trigger/signpost records and preview exact 24/16/12-byte before/after records for x/y/elevation, preserving script pointers and all other fields.
- [x] Reject stale expected bytes, changed ROM/map selection, malformed field values and out-of-map proposed coordinates; regenerate offline HTML and add regression coverage.
- [ ] Authenticate CUBE event-array ownership, layouts, safe transactions and Android/emulator save roundtrips before allowing writes. Strict parity unchanged.


## Checkpoint — mobile vanilla event ownership review (27 October 2026)
- [x] Show shared event-group/object/warp/trigger/signpost arrays and partial/cross-kind ROM-span overlaps across the explicitly declared vanilla atlas, with exact pointer-source navigation.
- [x] Revalidate bank pointers and event layouts on review and before navigation; bound output and preserve full counts; include modular/offline UI and synthetic tests.
- [ ] Independently authenticate CUBE event layouts, shared allocation ownership, safe write transactions and emulator/Android roundtrips. No strict parity score change.


## Checkpoint — touch-friendly proposed warp record byte preview (27 October 2026)
- [x] Select any inspected vanilla warp and preview proposed x/y/elevation/target IDs as an exact eight-byte before/after record, with expected-original-byte stale checks.
- [x] No ROM writes, pointer repointing or semantic permissions; standalone offline UI and regression tests included.
- [ ] Authenticate CUBE warp grammar and shared event-array ownership before permitting transactional edits. No strict parity score change.

## Checkpoint — mobile raw warp arrival tracing (27 October 2026)
- [x] Follow selected declared vanilla warp IDs to recorded destination warp coordinates, center mobile blockmap on that cell and report exact source/target ROM offsets.
- [x] Reject ambiguous aliased source headers, stale atlas snapshots, special IDs, out-of-range destination indexes and out-of-bounds arrival records; no script execution or ROM writes.
- [ ] Runtime warp semantics, CUBE-specific layouts, authenticated edit/save roundtrips, emulator and Android acceptance remain unverified; parity unchanged.

## Checkpoint — touch-friendly exact-byte blockmap change preview (27 October 2026)
- [x] Preview proposed tile ID and raw six-bit collision changes from explicit vanilla header/coordinates without modifying ROM bytes; tap rendered cells to prefill fields.
- [x] Show exact original/proposed bytes, source offset and declared-atlas shared-blockmap owner count; stale selection rejects changed cell words.
- [ ] This is **not** semantic editing or authenticated CUBE parity. No writes, relocation, emulator or Android acceptance; retain strict 0/30 score.

## Checkpoint — bounded raw object/trigger script byte preview (27 October 2026)
- [x] Inspect at most 64 exact bytes from an in-ROM object/trigger script pointer, with staged ROM reads, source offsets, truncation and fail-closed invalid pointer checks.
- [x] Add mobile/offline touch preview of 32 raw bytes and stale map-selection checks; no script decoding, command boundary inference or execution.
- [x] Add synthetic byte integrity tests and offline parsing assertions.
- [ ] Authenticate CUBE script command grammar and ownership; implement parser, safe edits, roundtrips, emulator/Android acceptance. **No verified parity score change.**


## Checkpoint — mobile paginated raw collision/elevation review (27 October 2026)
- [x] Show 4096-cell pages of raw six-bit blockmap values and most frequent tile IDs for explicitly selected matching vanilla map headers.
- [x] Preserve first occurrence ROM offsets for touch-to-hex inspection; reject mismatched header/dimensions and reset stale UI on map/ROM changes.
- [x] Sync modular/offline UI, synthetic staged-reader tests and source provenance.
- [ ] Authenticate CUBE collision behavior and map layout ownership; implement safe semantic writes and verify authentic ROM/emulator/Android roundtrips. **No parity score change.**


## Checkpoint — vanilla atlas pointer alias provenance (27 October 2026)
- [x] Detect shared header/layout/blockmap pointers across the explicitly declared vanilla map atlas, retaining source pointer offsets and bounded reference lists.
- [x] Surface ownership hints in mobile/offline UI with synthetic tests and no ROM writes.
- [ ] Authenticate engine-specific layout ownership, metadata overlays, allocation/repointing and save/emulator/Android roundtrips before semantic editing.

## Checkpoint — atlas-wide event coordinate batches (27 October 2026)
- [x] Review 16 declared vanilla maps per tap for raw event coordinate bounds and shared cells; aggregate every event and retain at most 128 findings.
- [x] Revalidate current ROM layouts per map, support staged reads, exact source offsets, offline/mobile parity and pagination regressions.
- [ ] Authenticate CUBE-specific map formats and complete authentic ROM, emulator, Android and safe-edit acceptance.

## Checkpoint — read-only vanilla event coordinate review (27 October 2026)
- [x] Audit warp/object/trigger/signpost coordinates against selected declared vanilla blockmap dimensions; flag out-of-map and shared-cell records without assuming errors.
- [x] Preserve exact source record/cell offsets and raw tile/high-bit values, bounded findings, staged reads, stale-layout rejection, mobile and offline UI, synthetic regression tests.
- [ ] Authenticate CUBE-specific event layouts, interpret collision behavior only with engine evidence, and prove semantic edit/save/emulator/Android roundtrips before claiming parity.

## Checkpoint — read-only vanilla event script pointer fields (27 October 2026)
- [x] Classify object and trigger script pointer fields, preserve exact source offsets and allow touch-to-hex navigation for conventional in-ROM targets.
- [x] Reject malformed event structures, retain null/non-ROM/out-of-ROM distinctions and test staged ROM immutability.
- [ ] Script grammar, code ownership, CUBE event formats, relocation, write safety and emulator/Android acceptance are not implemented.

## Checkpoint — bounded vanilla bank-table candidate probe (27 October 2026)
- [x] Inspect at most 4096 bytes near a user-supplied approximate offset for vanilla-format pointer-table candidates using explicit counts (max 128 maps).
- [x] Expose candidate selection in mobile/offline map UI, with synthetic ROM/staged accessor immutability tests.
- [ ] Automatically authenticate CUBE map-bank layout and real map counts from independently verified engine metadata; no semantic writes.

## Checkpoint — bounded atlas-wide link review (27 October 2026)
- [x] Inspect 16 declared vanilla maps per tap, count all raw warp/connection link statuses and display at most 128 flagged links per batch.
- [x] Preserve source offsets, staged reads, strict bounds, pagination and fail-closed malformed-pointer behavior with synthetic regression tests.
- [ ] Authenticated CUBE map-bank discovery, runtime warp resolution, Android performance and safe semantic editing remain unverified.

## Checkpoint — declared vanilla map-link audit (27 October 2026)
- [x] Read-only structural cross-reference for warp and connection targets within explicitly declared map-bank counts.
- [x] Preserve raw source offsets, distinguish missing declarations and special 0xFF fields, and flag out-of-range destination warp indexes without assuming runtime behavior.
- [x] Touch-friendly audit and target navigation, synthetic ROM regressions and offline build inclusion.
- [ ] Authenticate CUBE map banks, prove runtime link semantics, test on Android hardware and implement safe semantic map writes.


## Checkpoint — touch rendered map and raw event markers (27 October 2026)
- [x] Hit-test touch coordinates against native 16px rendered metatiles and preserve blockmap/attribute source provenance.
- [x] Project inspected raw warp and event coordinate badges onto the composed map canvas, with invalidation and no inferred passability.
- [ ] Add verified CUBE sprite/event semantics, mobile hardware acceptance, and safe map/warp editing after ownership gates.


## Checkpoint — explicit vanilla map atlas (27 October 2026)
- [x] Traverse explicitly counted vanilla bank/map pointer arrays and validate map header, layout and blockmap bounds, with a 4096-map cap.
- [x] Add touch-friendly map catalog selection and conditional warp/connection target navigation; invalidate on ROM/metadata changes.
- [ ] Authenticate CUBE-specific bank tables and map counts from trusted metadata, add source-owned semantic edits, and test device/emulator roundtrips.


## Checkpoint — raw metatile attributes (27 October 2026)
- [x] Preserve RSE/FRLG metatile behavior, layer, terrain and encounter bytes with exact ROM source offsets.
- [x] Display behavior/layer hints beside raw collision/elevation in the rendered map grid; no inferred walkability.
- [ ] Interpret collision and permissions only after verified CUBE layouts and emulator acceptance.

## Checkpoint — rendered vanilla map canvas (27 October 2026)
- [x] Read-only 16×16 RSE/FRLG metatile composition with primary/secondary tilesets, palette banks, flips and layers.
- [x] Opt-in canvas with explicit matching vanilla map header and standalone offline integration.
- [ ] CUBE layout authentication, emulator/device validation, collision/warp editing and safe semantic roundtrips.

## Checkpoint — LZ10 streaming (27 October 2026)
- [x] Decode and scan staged ROM graphics without full-ROM snapshots; preserve bounded LZ output and offline parity.
- [ ] Render composed metatiles/maps; verify Android performance and ROM-independent CUBE layouts.

## Watchdog checkpoint — vanilla blockset pointers and graphics preview (27 October 2026)
- [x] Decode vanilla primary/secondary blockset headers, graphics/palette/metatile/attribute/animation pointers and RSE/FRLG field ordering read-only.
- [x] Connect verified-offset pointer inspection to the existing raw/LZ 4bpp graphics viewer, with no semantic ROM writes.
- [ ] Optimize compressed preview to avoid full-ROM snapshots; render actual metatiles and map layers with correct palette banks and collision semantics.
- [ ] Authenticate CUBE blockset layouts and verify emulator/device roundtrips before editable maps.

## Watchdog checkpoint — source-matched raw event spatial hints (27 October 2026)
- [x] Overlay raw object, script-trigger and signpost indexes only on an exact matching blockmap offset and dimensions.
- [x] Validate coordinate/index bounds, suppress out-of-map hints, preserve immutable event arrays, and invalidate overlays on ROM/metadata changes.
- [ ] Real tileset rendering, collision/movement, authenticated CUBE layouts and safe map/event editing remain outstanding.

## Watchdog checkpoint — read-only vanilla object/script/signpost inspection (27 October 2026)
- [x] Decode all four vanilla event arrays with raw source offsets, pointers, coordinates and flags, preserving the source ROM and staged edits.
- [x] Reject malformed pointers, truncated arrays and cross-array/map-structure overlaps; expose touch-to-hex inspection in modular and offline builds.
- [ ] Authenticated CUBE event layouts, script disassembly, real map rendering, movement/collision semantics, event editing, repointing and device/emulator acceptance remain incomplete.
- [ ] Independently measure complete desktop-to-mobile feature parity; test counts do not establish 20% completion.


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
