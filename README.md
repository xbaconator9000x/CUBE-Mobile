# Test

This is a test.

---

## Development checkpoint — CUBE Emerald custom map structures and raw warps

The **Named Data** screen now supports explicit CUBE bank/map selection with a required per-bank map count, decoding the pinned CUBHMA custom 28-byte map header and layout into a bounded raw-cell viewport. It also offers read-only custom event-group/warp inspection, including source-byte navigation, out-of-map coordinate warnings and special-target hints. The standalone offline HTML contains both workflows.

The local SHA-256-gated CUBE bank smoke optionally reports aggregate custom map dimensions, raw-cell counts and event/warp counts. It never exports ROM bytes or paths. See [custom map discovery](docs/HMA_CUBE_CUSTOM_MAP_DISCOVERY.md), [custom warps](docs/HMA_CUBE_CUSTOM_EVENT_WARPS.md), and [local smoke](docs/LOCAL_CUBE_BANK_SMOKE.md).

**No verified CUBE ROM or metadata manifest has been curated.** These are metadata-shaped, read-only structural inspections with explicit map counts, not automatic map discovery, authenticated collision/passability, safe editing or emulator/Android acceptance. Strict parity remains **0/30 (0%)**.

## Development checkpoint — shared map pointer ownership hints

The declared vanilla atlas can now identify maps sharing exact header, layout or blockmap pointers, with bank/map references and source pointer offsets for touch-to-hex inspection. Aliases may be intentional and are not proof of safe ownership or CUBE layout compatibility. See [alias checkpoint](docs/VANILLA_ATLAS_POINTER_ALIASES.md).

## Development checkpoint — atlas-wide coordinate review

The read-only vanilla atlas can now review up to 16 declared maps per tap for out-of-map event coordinates and shared cells, retaining up to 128 findings with exact ROM provenance. Counts cover all inspected records even when findings truncate. This is not CUBE-authenticated or a collision/walkability editor. See [coordinate audit](docs/VANILLA_EVENT_COORDINATE_AUDIT.md).

## Development checkpoint — raw event coordinate review

The declared vanilla map atlas now offers a read-only coordinate integrity review for warps, objects, triggers and signposts. It highlights out-of-blockmap records and shared coordinates, with raw block-cell bytes and touch-to-hex provenance. Shared cells can be intentional; no CUBE layout or walkability is authenticated. See [coordinate checkpoint](docs/VANILLA_EVENT_COORDINATE_AUDIT.md).

**Private development repository for a full mobile port of CUBHMA (Cradi's Unofficial Build of Hex Maniac Advance), targeting CUBE-aware Pokémon Emerald editing and the other ROM families supported by upstream.**

> **Status: v0.5.9 — early foundation, NOT a complete port.** The working code today is an offline ROM inspection / patching workbench and a limited read-only CUBHMA TOML named-anchor inspector. The desktop editor's semantic engine, map/collision/event editors, scripts, sprites, trainers, Pokémon, sound and CUBE upgrades are **not yet ported**.

## Development checkpoint — touch-selectable rendered map

The opt-in vanilla map canvas now displays read-only raw warp/event coordinate badges and lets you tap a rendered metatile to inspect its blockmap and attribute source offsets, behavior and layer, with an explicit jump to hex. It does not authenticate CUBE layouts or interpret walkability. See [touch checkpoint](docs/MAP_CANVAS_TOUCH_CHECKPOINT.md).

## Development checkpoint — raw event script pointer fields

Inspect vanilla object/trigger script pointer words and their exact ROM source offsets, with optional hex navigation for conventional in-ROM targets. No script parsing, execution or editing. See [event checkpoint](docs/VANILLA_MAP_EVENTS_CHECKPOINT.md).

## Development checkpoint — bounded vanilla bank-table candidate probe

A manually bounded, read-only probe checks nearby aligned offsets against explicitly declared vanilla map counts. Candidates are structural hints, never proof of stock/CUBE layout or safe editing. See [atlas checkpoint](docs/VANILLA_MAP_ATLAS_CHECKPOINT.md).

## Development checkpoint — bounded atlas-wide link audit

Review 16 declared vanilla maps per tap for raw warp/connection targets, with bounded findings and exact ROM offsets. No automatic map discovery, CUBE authentication or semantic writes. See [map-link audit](docs/VANILLA_MAP_LINK_AUDIT.md).

## Development checkpoint — explicit vanilla map atlas

The Blockmaps screen can now inspect a bounded catalog of vanilla map headers using a known bank-table offset and **explicit per-bank map counts**. A selector opens declared maps; warp and connection records can navigate to declared targets. Counts and layouts are not automatically discovered or CUBE-authenticated, and the workflow remains read-only. See [atlas checkpoint](docs/VANILLA_MAP_ATLAS_CHECKPOINT.md).

## Development checkpoint — declared vanilla map-link audit

The manually declared vanilla map atlas can now cross-reference raw warp and connection destinations against supplied bank/map counts, inspect destination warp-record indexes and navigate to declared targets or source bytes. Special 0xFF fields remain unresolved and missing declarations are not treated as proof of invalidity. No CUBE authenticity or semantic writes are implied. See [map-link audit checkpoint](docs/VANILLA_MAP_LINK_AUDIT.md).

## Development checkpoint — rendered vanilla map canvas

An opt-in read-only canvas now composes 16×16 RSE/FRLG metatiles with palette banks, flips and layers from explicitly selected vanilla headers. Each rendered cell also displays its raw metatile behavior and layer bytes, without claiming walkability. The raw collision/elevation grid remains separate. This is not CUBE-authenticated map editing. See [rendering checkpoint](docs/VANILLA_METATILE_RENDER_CHECKPOINT.md).

## Development checkpoint — streamed LZ10 graphics

The graphics inspector now reads staged ROM bytes directly for bounded LZ10 decoding and candidate scans, avoiding a full-ROM snapshot. See [checkpoint](docs/LZ_ACCESSOR_CHECKPOINT.md). Map rendering and CUBE authentication remain unfinished.

## Development checkpoint — exact TOML import identity (mobile + offline)

Local and pinned-upstream TOML imports now hash **raw bytes before UTF-8 decoding** and commit file digests atomically alongside successfully parsed metadata. The named-data screen displays each file's SHA-256 and a fail-closed ROM compatibility status; replacing the ROM, applying a patch or resetting metadata invalidates stale results. Import reads are rejected if the ROM changes or a newer import starts. Raw TOML buffers are not retained after import. The generated offline HTML includes this workflow. The curated CUBE profile registry is **still empty**, multiple overlays still require an authenticated manifest, and no semantic writes are enabled. See [exact metadata binding checkpoint](docs/EXACT_METADATA_BINDING.md).


## Development checkpoint — read-only map blockmap codec

`src/map-blocks.js` now implements a source-grounded, **read-only** GBA map blockmap cell decoder, matching upstream CUBHMA's 10-bit tile ID and 6-bit collision/elevation field. It inspects bounded map viewports with strict ROM bounds and preserves exact byte offsets. The **Blockmaps** screen now exposes this codec as a touch-friendly 12 × 10 read-only viewport with manual hex offset and decimal dimensions, including staged edits and tap-to-hex navigation. This is **not a map editor**: it does not discover map pointers, infer walkability, render graphics, edit maps, or validate CUBE-specific layout ownership. See `tests/map-blocks.test.mjs`.

## Development checkpoint — read-only vanilla map header/layout resolution

The Blockmaps screen can now resolve a **manually supplied, independently verified vanilla RSE/FRLG map header or layout offset** into bounded blockmap dimensions and a ROM offset, then inspect the existing raw tile/collision cells. The decoder follows the upstream CUBHMA vanilla map formats and preserves source pointer provenance. It refuses declared custom/expansion metadata and never infers layout authenticity from a ROM header. This is **not** CUBE map-bank discovery, rendering, editing or warp/event interpretation. See [vanilla map layout checkpoint](docs/VANILLA_MAP_LAYOUT_CHECKPOINT.md).

## Development checkpoint — explicit vanilla bank and warp inspection

The Blockmaps screen now follows an **explicitly supplied vanilla bank pointer table** and selected bank/map indices, using separately supplied counts, into a bounded map header/layout. A read-only warp inspector displays event counts and raw warp coordinates/destination IDs with tap-to-hex navigation. The current staged ROM bytes are read without modifying the source. This is not authenticated CUBE map-bank discovery, event editing or walkability rendering. See [vanilla bank/warp checkpoint](docs/VANILLA_BANK_WARP_CHECKPOINT.md).

## Development checkpoint — vanilla map connections

A read-only map connections inspector now follows the selected vanilla header's connections pointer and displays raw direction codes, signed displacement, target bank/map and source offsets with tap-to-hex navigation. It rejects invalid counts, pointers, bounds and overlaps, but does not authenticate map topology or CUBE expansion formats. See [connections checkpoint](docs/VANILLA_CONNECTIONS_CHECKPOINT.md).

## Development checkpoint — vanilla blockset pointers and raw tileset preview

The Blockmaps screen can now inspect primary and secondary vanilla RSE/FRLG blockset headers and open their referenced 4bpp graphics and palette in the existing Graphics viewer. It preserves raw pointer provenance and compression flags, with bounds and overlap checks. **This is a raw tile-sheet preview, not assembled map rendering or verified CUBE compatibility.** See [blockset preview checkpoint](docs/VANILLA_BLOCKSET_PREVIEW_CHECKPOINT.md).

## Development checkpoint — raw event spatial hints

The Blockmaps viewport now annotates cells with **O** (object), **S** (script trigger) and **P** (signpost) indexes from the same explicitly selected vanilla map header. Hints appear only when the inspected blockmap offset and dimensions exactly match, and are invalidated on ROM edits, ROM replacement and metadata changes. They are not sprite renders, collision/passability assertions or verified script semantics.

## Development checkpoint — vanilla object, script trigger and signpost inspection

The Blockmaps screen now reads **raw, read-only vanilla event records** for objects (24 bytes), script triggers (16 bytes) and signposts (12 bytes) from an explicitly selected RSE/FRLG map header. It preserves source offsets, coordinates, raw script pointer words and signpost arguments, with tap-to-hex navigation. All four event arrays are cross-checked for overlaps and bounds. This does **not** authenticate CUBE layouts, interpret scripts, draw overworld sprites or permit semantic edits. See [event inspection checkpoint](docs/VANILLA_MAP_EVENTS_CHECKPOINT.md).

## Development checkpoint — touch map navigation and warp hints

The read-only Blockmaps viewport now supports large touch pan controls and optional raw warp-index markers on matching inspected vanilla map cells. Markers are cleared when the ROM or selected map changes and never represent verified passability. See [touch viewport checkpoint](docs/TOUCH_MAP_VIEWPORT_CHECKPOINT.md).

## Current working code

- **Exact ROM comparison (unreleased):** after computing the local staged-ROM SHA-256, optionally paste a published expected SHA-256 to compare exact bytes. A matching user-provided digest does **not** authenticate its provenance, CUBE layout or TOML. The bundled curated-profile registry is intentionally **empty** until independently verified CUBE ROM and matching metadata digests exist; no semantic writes are unlocked. See [ROM fingerprint registry requirements](docs/ROM_FINGERPRINT_REGISTRY.md).
- **Local exact-byte ROM SHA-256 identity (unreleased):** opt-in workspace action hashes the current base plus staged edits in bounded 64 KiB chunks without allocating a full ROM copy, reports progress, cancels on ROM replacement, and invalidates results when bytes change. This is a cryptographic **identity only**, not proof of stock or CUBE layout, provenance, or safe metadata compatibility. No trusted CUBE fingerprint allowlist has been established.


- Open GBA ROMs locally (no file uploading), header inspection, guarded hex editing, undo/redo.
- GBA ROM pointers, byte search and safe Save As copies.
- BPS/IPS import; BPS source, patch and output CRC validation; IPS export.
- Read-only LZ77 4bpp graphics stream discovery and palette preview (not semantic graphics editing).
- Load CUBHMA/HMA `[[NamedAnchors]]` TOML records, search formats/addresses and inspect named pointers.
- **CUBE expansion-layout metadata guard (unreleased):** recognise upstream `MetadataLayout = '''expansion'''` and legacy trainer-party `tpte` named-run markers in imported TOML. Reject mixing vanilla stock reference files with declared expansion or other custom layouts, even when the ROM carries a valid Emerald header; display the imported layout evidence persistently. **This does not identify or authenticate the ROM itself**; unmarked CUBE ROMs can still be misidentified from their header, and all semantic interpretation remains read-only.
- **Version-aware stock metadata safety:** validates GBA header code, header checksum and exact revision before fetching upstream reference TOML; refuses known mismatched stock TOML imports. Neither header nor TOML filenames authenticate CUBE/custom ROM layout.
- **Experimental read-only fixed table previews:** decode a strictly bounded subset of CUBHMA `ArrayRun` formats (byte/word/dword integers, raw text bytes and ROM pointers), show up to eight rows, and jump to a row in hex. Unknown/dynamic layouts fail closed; metadata is not ROM-version authenticated.
- **Read-only named-list enum hints (unreleased):** for supported integer fields with an imported `[[List]]` suffix, show an unverified option label alongside the original numeric value. Conflicting, sparse, out-of-range and anchor-shadowed labels are suppressed. This does not decode table-derived enums, support offsets or permit semantic edits.
- **Read-only HMA `[[OffsetPointer]]` support:** parse signed displacements from TOML and inspect source locations using upstream-adjusted pointer semantics, without repointing or claiming metadata authenticity.
- **Read-only named-array count dependencies:** resolve supported table lengths from another resolved array, including forward/chained references and bounded CUBHMA `ParentOffset` beginning/end margins; reject invalid resulting counts, cycles, out-of-ROM spans and overlapping table claims. No write/repoint capability is implied.
- **Read-only HMA named-list lengths:** parse bounded `[[List]]` entries (including multiline and sparse lists), resolve table counts from list sizes with ParentOffset margins, and reject contradictory list declarations. `UnmappedConstant` values are deliberately **not** used as table lengths.
- **Read-only ROM-backed `[[MatchedWords]]` lengths:** parse HMA WordRun declarations, require every source of a name to decode to the same integer, resolve supported dependent tables and ParentOffset margins, and reject overlapping source claims. A documented upstream discrepancy between WordRun and ArrayRun offset/multiplier arithmetic is treated as ambiguous rather than guessed. Counts refresh after staged ROM edits; patch application clears potentially stale metadata. This is not authenticated ownership or safe repointing.
- **Read-only fixed-table text and upstream-default PCS preview (unreleased):** show bounded raw hex, escape-aware `0xFF` termination, and a clearly **unverified** Gen 3 fallback character preview for recognised, header-valid games. Unknown bytes/control arguments remain visible. This does **not** authenticate CUBE-specific text mappings, game macros, metadata layouts or support text editing.
- **Optional local PCS reference import (unreleased):** import an upstream-style `pcsReference.txt` from the device to preview mapped glyphs, control lengths and game-specific text macros in supported fixed-table text fields. Invalid imports leave the previous mapping intact; opening another ROM clears the reference. Imported text mappings are **unverified**, read-only, and never used for semantic writes or relocation.
- **Authentic upstream PCS import compatibility (unreleased):** regression-tested against a pinned, MIT-licensed upstream `pcsReference.txt` test fixture, including underscore-separated game scopes and game-specific colour macros. The fixture is **not bundled** with the app; local reference imports are still unverified and read-only.
- **Read-only byte-claim collision gate:** detects conflicts among supported table spans, all declared MatchedWords source bytes (including unresolved words), and OffsetPointer sources. Exact OffsetPointer overlays on complete pointer fields remain supported; scalar/partial/overlapping claims suppress typed reference results. Uses bounded indexed interval lookups, not an authoritative run ownership graph.
- **Cross-claim unknown-anchor safety (unreleased):** unresolved named-anchor starts also invalidate intersecting MatchedWords count sources and explicit OffsetPointer sources, including standalone sources outside typed tables. Half-open boundaries remain disjoint; unknown extents are **not** inferred.\n- **Conservative unresolved-anchor collision gate:** if a named anchor with unsupported/unresolved format starts inside a supported table, suppress that table's typed interpretation and its dependent/offset-pointer claims. This only reserves a one-byte witness; unknown run extents remain unknown, not free space. Legitimate aliases may be conservatively rejected.
- **Metadata conflict preservation:** retain contradictory named-anchor declarations from multiple TOML sources instead of silently accepting the last version. Conflicting names are visible but excluded from typed reads; actual CUBHMA overlay/precedence rules are not yet ported.
- **Opt-in read-only pointer reference inspection:** find exact-value matches in metadata-declared fixed-table pointer slots and separate unverified aligned-byte candidates, with scan limits and explicit incomplete coverage. This is **not** CUBHMA's full ownership model or safe repointing.
- Browser history-backed navigation on Android, including Back/Forward.
- CRC-bound JSON sidecar project edits.

The versioned runnable checkpoint is [app/CUBHMA_Mobile_Lab_Offline.html](app/CUBHMA_Mobile_Lab_Offline.html). This app remains local-first and does **not** contain game ROMs.

## Development

```bash
npm test
npm run build:standalone
npm run start
```

Open `http://localhost:8000/` for the modular web app. The standalone builder regenerates `app/CUBHMA_Mobile_Lab_Offline.html` for a browser that accepts local HTML files. No npm dependencies are required for the code or unit tests.

- App UI: `index.html` and `src/styles.css`
- Browser logic: `src/app.js`
- ROM manipulation and patches: `src/core.js`
- Named-anchor TOML inspection: `src/semantic.js`
- Bounded text inspection and upstream-default PCS preview: `src/text-inspection.js`, `src/pcs-default.js`
- Unit tests: `tests/`
- Full-port scope: `FULL_PORT_PLAN.md`
- Development checkpoints: `ROADMAP.md` and `CHANGELOG.md`
- CI: `.github/workflows/ci.yml`

## Privacy, licence and ROM safety

**This GitHub repository is currently public (changed by its owner on 27 October 2026).** Do not enable GitHub Pages or copy a workflow that deploys the site unless you deliberately want that deployment: Pages visibility is not determined solely by repository privacy. The CI workflow only runs tests; it does not publish the app.

Do not commit copyrighted game ROMs, extracted proprietary assets, user saves or user-specific project files. `.gitignore` excludes common formats as a guard, not an infallible blocker. Never force-push over working checkpoints. Preserve source originals and verify compiled output in an emulator before considering ROM edits reliable.

The new mobile code is an independent MIT-licensed implementation; **it is not endorsed by upstream**. CUBHMA source: https://github.com/kcradi/CUBHMA ; Hex Maniac Advance: https://github.com/haven1433/HexManiacAdvance (MIT). When bringing upstream code into this repository, retain its copyright and licence notices and document the imported version.

## Goal and contribution standards

The objective is feature parity with the upstream desktop editor on a touchscreen. Do not substitute hex-level mockups for semantic map, script, sprite or Pokémon editors. A feature is complete only with round-trip ROM tests, pointer/allocation safety checks, compatibility evidence and a usable mobile workflow. See [FULL_PORT_PLAN.md](FULL_PORT_PLAN.md).
