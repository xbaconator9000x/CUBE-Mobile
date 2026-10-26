# CUBE Mobile

**Private development repository for a full mobile port of CUBHMA (Cradi's Unofficial Build of Hex Maniac Advance), targeting CUBE-aware Pokémon Emerald editing and the other ROM families supported by upstream.**

> **Status: v0.5.9 — early foundation, NOT a complete port.** The working code today is an offline ROM inspection / patching workbench and a limited read-only CUBHMA TOML named-anchor inspector. The desktop editor's semantic engine, map/collision/event editors, scripts, sprites, trainers, Pokémon, sound and CUBE upgrades are **not yet ported**.

## Current working code

- Open GBA ROMs locally (no file uploading), header inspection, guarded hex editing, undo/redo.
- GBA ROM pointers, byte search and safe Save As copies.
- BPS/IPS import; BPS source, patch and output CRC validation; IPS export.
- Read-only LZ77 4bpp graphics stream discovery and palette preview (not semantic graphics editing).
- Load CUBHMA/HMA `[[NamedAnchors]]` TOML records, search formats/addresses and inspect named pointers.
- **Version-aware stock metadata safety:** validates GBA header code, header checksum and exact revision before fetching upstream reference TOML; refuses known mismatched stock TOML imports. Neither header nor TOML filenames authenticate CUBE/custom ROM layout.
- **Experimental read-only fixed table previews:** decode a strictly bounded subset of CUBHMA `ArrayRun` formats (byte/word/dword integers, raw text bytes and ROM pointers), show up to eight rows, and jump to a row in hex. Unknown/dynamic layouts fail closed; metadata is not ROM-version authenticated.
- **Read-only HMA `[[OffsetPointer]]` support:** parse signed displacements from TOML and inspect source locations using upstream-adjusted pointer semantics, without repointing or claiming metadata authenticity.
- **Read-only named-array count dependencies:** resolve supported table lengths from another resolved array, including forward/chained references and bounded CUBHMA `ParentOffset` beginning/end margins; reject invalid resulting counts, cycles, out-of-ROM spans and overlapping table claims. No write/repoint capability is implied.
- **Read-only HMA named-list lengths:** parse bounded `[[List]]` entries (including multiline and sparse lists), resolve table counts from list sizes with ParentOffset margins, and reject contradictory list declarations. `UnmappedConstant` values are deliberately **not** used as table lengths.
- **Read-only ROM-backed `[[MatchedWords]]` lengths:** parse HMA WordRun declarations, require every source of a name to decode to the same integer, resolve supported dependent tables and ParentOffset margins, and reject overlapping source claims. A documented upstream discrepancy between WordRun and ArrayRun offset/multiplier arithmetic is treated as ambiguous rather than guessed. Counts refresh after staged ROM edits; patch application clears potentially stale metadata. This is not authenticated ownership or safe repointing.
- **Read-only byte-claim collision gate:** detects conflicts among supported table spans, all declared MatchedWords source bytes (including unresolved words), and OffsetPointer sources. Exact OffsetPointer overlays on complete pointer fields remain supported; scalar/partial/overlapping claims suppress typed reference results. Uses bounded indexed interval lookups, not an authoritative run ownership graph.
- **Conservative unresolved-anchor collision gate:** if a named anchor with unsupported/unresolved format starts inside a supported table, suppress that table's typed interpretation and its dependent/offset-pointer claims. This only reserves a one-byte witness; unknown run extents remain unknown, not free space. Legitimate aliases may be conservatively rejected.\n- **Metadata conflict preservation:** retain contradictory named-anchor declarations from multiple TOML sources instead of silently accepting the last version. Conflicting names are visible but excluded from typed reads; actual CUBHMA overlay/precedence rules are not yet ported.
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
- Unit tests: `tests/`
- Full-port scope: `FULL_PORT_PLAN.md`
- Development checkpoints: `ROADMAP.md` and `CHANGELOG.md`
- CI: `.github/workflows/ci.yml`

## Privacy, licence and ROM safety

**This GitHub repository is private.** Do not enable GitHub Pages or copy a workflow that deploys the site unless you deliberately want that deployment: Pages visibility is not determined solely by repository privacy. The CI workflow only runs tests; it does not publish the app.

Do not commit copyrighted game ROMs, extracted proprietary assets, user saves or user-specific project files. `.gitignore` excludes common formats as a guard, not an infallible blocker. Never force-push over working checkpoints. Preserve source originals and verify compiled output in an emulator before considering ROM edits reliable.

The new mobile code is an independent MIT-licensed implementation; **it is not endorsed by upstream**. CUBHMA source: https://github.com/kcradi/CUBHMA ; Hex Maniac Advance: https://github.com/haven1433/HexManiacAdvance (MIT). When bringing upstream code into this repository, retain its copyright and licence notices and document the imported version.

## Goal and contribution standards

The objective is feature parity with the upstream desktop editor on a touchscreen. Do not substitute hex-level mockups for semantic map, script, sprite or Pokémon editors. A feature is complete only with round-trip ROM tests, pointer/allocation safety checks, compatibility evidence and a usable mobile workflow. See [FULL_PORT_PLAN.md](FULL_PORT_PLAN.md).
