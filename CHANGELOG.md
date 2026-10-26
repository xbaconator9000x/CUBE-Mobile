# Changelog

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
