# Text inspection checkpoint

Added a bounded, pure, read-only fixed-width byte inspector in `src/text-inspection.js` with explicit `0xFF` termination, hex output, and an ASCII hint. It does **not** decode Pokémon PCS and does not assert ROM ownership or permit edits. Synthetic tests verify immutable bytes, staged-reader compatibility and invalid-span refusal.

**Not yet integrated into the mobile UI.** Next: verify authentic CUBHMA PCS mappings and version handling, integrate as an optional view behind semantic ownership checks, then add game-specific fixtures. Do not expose semantic writes or call this a completed text editor.
