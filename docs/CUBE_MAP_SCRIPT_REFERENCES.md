# Q022 — bounded CUBE map-script reference index (partial)

The pinned CUBHMA Emerald map-script decoder now has a separate, read-only pointer-reference index. It reports the exact ROM offset of each direct script pointer, each conditional-table pointer and each conditional branch's script pointer, with the raw pointer and target ROM offset.

The index groups repeated script targets separately from repeated conditional-table targets, and warns when a script target lands inside a known map header, layout, blockmap, map-pointer table or map-script/conditional table. Results retain complete counts even when the displayed reference list is truncated by an explicit budget.

This does **not** disassemble opcodes, execute scripts, establish global pointer ownership, authenticate a CUBE ROM or authorize writes. Conditional tables are decoded using the existing pinned source-grounded 8-byte format and terminator checks. Synthetic tests cover pointer source offsets, aliases, structural warnings, malformed pointers and truncation. Modular and offline code remain in sync; touch navigation and authentic ROM acceptance are still outstanding.
