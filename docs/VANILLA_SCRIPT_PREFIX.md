# Bounded vanilla event-script command inspection

The read-only `inspectVanillaScriptCommandPrefix` helper in
`src/vanilla-script-prefix.js` recognizes a deliberately restricted
subset of **fixed-width** RSE/FRLG event commands. Its command signatures
were checked against pinned upstream
[kcradi/CUBHMA scriptReference.txt](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Code/scriptReference.txt)
and [ScriptParser.cs](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Code/ScriptParser.cs).

It reports exact command/argument byte offsets, raw bytes, unsigned
little-endian values, conventional GBA pointer status, and a reason for
stopping. It never follows branch destinations or treats a plausible pointer
as proof of executable script ownership. The first unknown opcode or
incomplete command stops the scan without guessing the next boundary.
Terminating commands stop the linear preview. Byte and command limits
are mandatory, bounded to 256 bytes and 64 commands.

This is **not** a general script decompiler. It intentionally omits variable-
length commands, game-specific opcodes and macro expansion. CUBE or CFRU
may replace the vanilla grammar. This helper must never authorize edits,
execute ASM, infer full script length, or count as verified CUBE parity.
No ROM files or ROM-derived byte fixtures are committed.
