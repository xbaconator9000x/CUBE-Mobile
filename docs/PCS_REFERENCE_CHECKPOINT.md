# HMA PCS reference parser checkpoint (27 October 2026)

Source comparison: `kcradi/CUBHMA`, `src/HexManiac.Core/Models/PCSString.cs`, blob `64c6512f2f052c5f4e202333af4acb406e2e3c05`. The implementation follows the upstream reference grammar for `0xXX` glyphs (including quoted consecutive characters), `CC_XX` argument counts, and `[macro]` byte sequences scoped by `@!game(...)`. It implements bounded, read-only reference-based decoding and game-scoped macro recognition.

**Safety:** The parser rejects contradictory glyphs/control lengths/macros, unsupported game directives, invalid hex bytes, excessive files/records, and out-of-range glyph expansions. The decoder cannot read past the selected ROM span, preserves FF bytes inside control arguments, and never modifies ROM data. Imported reference files are **not authenticated** against the ROM, and their presence does not establish a safe edit or pointer relocation.

**Scope:** `src/pcs-reference.js` exports `parseHmaPcsReference` and `decodeHmaPcsReference`. Unit tests use **synthetic** byte arrays and reference lines, not copyrighted ROMs. This module is **not yet wired to the mobile UI** or the standalone HTML build; the existing unverified default fallback remains the current UI preview.

**Outstanding:** Compare against the real upstream `pcsReference.txt` and licensed game-specific fixtures; validate all accepted reference formatting, macro collision ordering, and custom CUBE overrides. Integrate an opt-in local reference picker, with explicit game-code and provenance warnings, then update standalone HTML. Keep semantic text writes disabled until full run ownership, fingerprint, and save-roundtrip gates pass.
