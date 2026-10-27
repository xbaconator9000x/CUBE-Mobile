# Vanilla script operand-pointer provenance (read-only)

The pinned [CUBHMA script reference](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Code/scriptReference.txt) defines several fixed-width commands carrying conventional four-byte GBA pointers. The bounded decoder now supports source-grounded hints for script branches (04–07), generic loadpointer data (0F), ASM/code entrypoints (23–24), movement data (4F–50), and preparemsg text (67).

`auditVanillaScriptOperandPointers` reports exact operand source offsets, raw pointer values, conventional ROM-boundary status, target offsets where in range, and role hints. It stops wherever the conservative prefix decoder stops, caps findings to 64, and preserves total counts when truncated. Map event-script audits aggregate these statuses and roles; the opt-in SHA-256-checked local ROM smoke report includes **counts only**, not raw script bytes, strings, target offsets, or local file paths.

**Not authenticated:** The roles describe command signatures, not the target's actual format or ownership. No target is dereferenced, followed, executed or modified. Unknown/variable-width commands stop decoding. CUBE-specific grammar, genuine ROM save/reopen, emulator operation, Android hardware acceptance and strict parity credit remain outstanding.
