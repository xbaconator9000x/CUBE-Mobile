# Changelog

## Unreleased — conservative named-list enum preview
- Preserve HMA integer field enum suffixes and show matching imported `[[List]]` names as explicitly unverified, read-only hints beside the raw numeric value.
- Do not label conflicting, sparse, out-of-range or named-anchor-shadowed options; no ROM writes or ownership claims.
- Add synthetic regression tests and synchronize the offline app. Full enum grammar, offsets, table-derived options and CUBE semantics remain unsupported.

## Unreleased — unresolved anchor cross-claim safety (read only)
- Extend the conservative one-byte unknown-anchor witness to intersecting ROM-backed MatchedWords and OffsetPointer source spans, even outside supported tables.
- Propagate count-source ambiguity to dependent tables; reject offset sources that overlap an unresolved anchor. Half-open adjacent claims remain distinct.
- Index unknown anchor starts for bounded binary-search audits; add synthetic ROM immutability, multi-claim and boundary regressions.
- This does not establish unknown run extents, authenticated metadata, writable ownership or safe relocation.

## Unreleased — authentic CUBHMA PCS reference compatibility (read only)
- Fix import of the pinned upstream `pcsReference.txt`: accept underscore-separated game scopes and the intentional single-character quote glyph declaration.
- Match CUBHMA `PCSString.FindMacro` declaration-order precedence rather than longest-first/alphabetical ordering, preserving canonical alias spellings such as `[grey]` over `[gray]`.
- Add test-only upstream PCS resource with pinned commit provenance and MIT licence; validate game-scoped colour macros, glyphs, control lengths, decoding and ROM immutability.
- Do not ship upstream test fixture in the standalone HTML. User-supplied references remain unauthenticated and cannot authorize ROM writes.
- **Remaining:** exact upstream macro alias/precedence parity, CUBE-specific text encodings, authentic ROM fingerprints, safe semantic text editing, Android device acceptance.


## Unreleased — upstream-default Gen 3 PCS preview (read only)
- Add a bounded fallback PCS decoder based on the pinned upstream `PCSString.GetDefaultPCS` mapping and default control-code lengths, restricted to recognised Gen 3 game codes.
- Display an explicitly unauthenticated PCS fallback preview in safe fixed-table text fields while retaining original raw bytes and ASCII hints.
- Treat `0xFF` inside escape arguments as data, not an end-of-string marker; flag truncated controls and unknown glyphs without fabricating characters.
- Add synthetic tests for glyphs, control lengths, end-exclusive boundaries, staged readers, and ROM immutability; regenerate offline HTML.
- **Not complete:** reference-file PCS overrides, game macros, CUBE-specific text, authentic ROM fingerprints, semantic text editing and Android/device parity.

## Unreleased — unresolved-anchor byte-claim safety (read only)
- Treat the start byte of each unresolved named anchor as an unsafe overlapping claim when it falls inside a resolved supported table; propagate conflicts to dependent tables and declared offset-pointer sources.
- Preserve disjoint and end-exclusive boundary cases, report a bounded collision witness count and add generated-byte regression coverage.
- This is deliberately conservative; aliases and the full extent of unsupported run formats require upstream verification. No ROM writes or relocation are enabled.

## v0.5.9 — conservative ROM byte-claim collision gates (read only)
- Audit supported table, MatchedWords and OffsetPointer byte claims with indexed interval witnesses, including unresolved MatchedWords sources.
- Mark every colliding word source in a table rather than only the first; propagate ambiguity to word-derived and chained tables.
- Allow an OffsetPointer declaration to coexist with a table only when it starts at an exact four-byte pointer field. Suppress typed interpretation for scalar, partial, overlapping and conflicting claims.
- Surface unsafe offset-source counts and warnings in the mobile inspector. No semantic writes or relocation are enabled.
- Add eleven synthetic regression cases, including overlapping word/offset sources, adjacent table boundaries and a 2,000-table scan.
- **Remaining:** full upstream formatted-run model, CUBE-specific fingerprints, dynamic grammar, map/collision/event/script/graphics/audio editors, round-trip and Android device acceptance.

## v0.5.8 — ROM-backed MatchedWords table lengths (read only)
- Parse CUBHMA `[[MatchedWords]]` metadata, including byte/halfword/word lengths, signed offsets, multipliers and source provenance; duplicate declarations are checked without hiding conflicts.
- Derive supported table lengths from the current staged ROM bytes only when every word source agrees. Preserve anchor > list > matched-word precedence; resolve ParentOffset margins and downstream linked tables.
- Reject ambiguous arithmetic where pinned upstream `WordRun.Read` and `ArrayRun.ParseLengthFromAnchor` disagree, nonintegral values, invalid ROM bounds, conflicting/overlapping word sources and word/table ownership collisions. No inferred fallback lengths.
- Refresh ROM-backed counts after raw edits/undo; applying IPS/BPS patches clears stale metadata. Include supported tables in read-only previews and typed reference scans.
- Add synthetic regression tests for parsing, precedence, offsets, disagreement, overlap, pointer scans and ROM immutability. Regenerate standalone HTML.
- **Still outstanding:** authenticated metadata overlays, full formatted-run graph, safe writes/repointing, maps/collision/events/scripts/Pokémon/trainers/sprites/audio/CUBE extensions and Android acceptance.


## v0.5.7 — named-list-derived table lengths (read only)
- Parse bounded CUBHMA `[[List]]` entries with inline/multiline arrays, sparse decimal/hex numeric indices, triple-quoted labels containing apostrophes and explicit metadata conflicts. Smoke-checked against all 61 named lists in upstream `default.toml`.
- Resolve table row counts from list cardinality, including ParentOffset margins and downstream dependent tables; named anchors retain upstream precedence.
- Expose list-derived provenance in mobile inspection and include non-overlapping supported pointer fields in read-only reference scans.
- Reject malformed list metadata atomically; keep unsupported `UnmappedConstant` and ROM-backed `MatchedWords` semantics distinct.
- Add synthetic regression coverage; regenerate offline HTML and update service worker version.
- **Outstanding:** matched-word constants, metadata overlay/authentication, full semantic ownership, map/collision/warps, scripts, sprites, audio, Pokémon/trainer editing and Android tests.


## v0.5.6 — ParentOffset margins and metadata conflict safety
- Support a conservative, source-grounded subset of `ArrayRun.ParentOffset`: one positive margin adds rows at the end; one negative margin removes from the beginning; two signed margins adjust beginning and end separately.
- Resolve bounded margin-adjusted counts through linked table chains and reject zero, excessive, unsupported and out-of-ROM results without falling back to guessed rows.
- Retain conflicting named-anchor declarations across TOML sources rather than last-write-wins; ambiguous names cannot be typed or used as verified pointer owners.
- Show margin provenance and metadata conflict warnings in the mobile inspector. Add synthetic regression tests and regenerate offline HTML.
- **Not yet implemented:** authenticated metadata overlay precedence, full CUBHMA grammar, authoritative pointer ownership, safe semantic writes, native maps/collision/scripts/graphics/audio or Android APK testing.


## v0.5.5 — conservative named-array lengths and overlap audit
- Resolve read-only table lengths linked by an exact named-array reference, including forward and chained dependencies, without recursive traversal.
- Refuse unsupported margin/stream/record formats, missing/cyclic parents, conflicting duplicate names and out-of-ROM layouts.
- Audit overlaps between resolved named table spans, report bounded witnesses and exclude conflicted tables from typed pointer matching and preview.
- Display linked-length provenance and overlap warnings in the mobile inspector; no semantic writes or ownership claims.
- Add synthetic dependency, overlap and ROM-immutability tests; update the offline build and service worker cache.
- **Remaining:** full CUBHMA format grammar and ownership, CUBE fingerprinting, safe relocation, maps/collision/warps, scripts, graphics, audio, Pokémon/trainer editing and Android acceptance testing.

## v0.5.4 — OffsetPointer metadata and read-only references
- Parse HMA `[[OffsetPointer]]` declarations, including signed decimal and two's-complement hex offsets, with bounds checks and fail-closed malformed record handling.
- Resolve adjusted pointer references according to upstream `PokemonModel.ReadPointer` semantics; source precedence prevents false raw/table candidates.
- Wire OffsetPointer sources into mobile Named Data inspector and reject conflicting declarations atomically.
- Add eleven synthetic offset-pointer regression tests; no copyrighted ROM data and no semantic write support.
- Still outstanding: dynamic table grammar, ROM-authenticated metadata, complete pointer ownership, safe relocation, map/collision/warps/scripts/sprites/audio and Android device testing.

## v0.5.3 — bounded pointer cross-reference inspection
- Added read-only typed table pointer field cross-references for supported fixed-array formats.
- Added clearly unverified 4-byte aligned raw candidate search bounded to the first 2 MiB in the mobile UI.
- Added per-anchor scan button, source offset navigation and transparent incomplete-coverage notices.
- Added twelve pointer cross-reference regression tests, including unaligned typed fields, dynamic-format rejection, output caps and the 32 MiB pointer ceiling. Version 0.5.3.
- Reject reference scans targeting anchors above the conventional GBA ROM pointer window; recover the scan control after failures.
- **Still incomplete:** dynamic tables, authoritative ownership/repointing, large-ROM incremental scans, map/collision/script/sprite/audio editors.

## v0.5.2 — ROM revision and metadata compatibility guards
- Add header-validated exact-code/revision stock metadata resolution; unknown revisions fail closed.
- Block incompatible pinned stock metadata imports before changing the current metadata set.
- Keep custom metadata read-only and unauthenticated; CUBE-specific ROM identification remains future work.
- Add eight identity/compatibility regression tests and bump cache/app version to v0.5.2.

## v0.5.1 — read-only HMA table inspection
- Parse conservative fixed-length `ArrayRun` formats directly from imported CUBHMA TOML.
- Preview at most eight rows of unsigned numeric fields, range-checked ROM pointers and raw text bytes; no semantic writes.
- Reject dynamic, unknown or out-of-bounds table formats rather than guessing.
- Touch-friendly horizontally scrolling table and row-to-hex jump; added parser and mobile browser smoke tests.
- **Still incomplete:** CUBHMA's actual semantic engine, PCS decoding, dynamic anchors, allocation, maps, scripts, graphics editors and Android APK.

## v0.5 — source checkpoint
- Imported a self-contained CUBHMA Mobile Lab offline web workbench.
- Restored modular HTML/CSS/JavaScript sources from the verified standalone bundle.
- Named-anchor TOML import/search/read-only inspection, pointer navigation.
- Preserved Android Back/Forward hash routing, ROM safety, patches and graphics decoding.
- Initialized this private GitHub repository with test and build automation.

## v0.4
- Back/Forward tab navigation with URL history; Home control.

## v0.3
- Improved graphics inspector: LZ10 scanning/decoding, palette handling and safe empty state.

## v0.2
- Initial touch-friendly ROM byte workbench, patch tools and offline PWA foundation.

This changelog tracks the independent mobile application, not upstream CUBE or CUBHMA release versions.
