# Text inspection checkpoint

Added a bounded, pure, read-only fixed-width byte inspector in `src/text-inspection.js` with explicit `0xFF` termination, hex output, and an ASCII hint. It does **not** decode Pokémon PCS and does not assert ROM ownership or permit edits. Synthetic tests verify immutable bytes, staged-reader compatibility and invalid-span refusal.

**Mobile UI integration (unreleased):** Supported, non-conflicted fixed-table text-byte cells now show FF terminator status and expose a clearly labelled ASCII-only hint on hover. The standalone build includes the module. This is still **not** Pokémon PCS decoding, an editable text field, or a claim that ROM metadata is authenticated. Next: verify authentic upstream CUBHMA PCS mappings and version handling, add game-specific licensed fixtures, and test on Android. Semantic writes remain disabled.
