# Declared-atlas vanilla script operand alias audit

This **read-only** audit examines fixed-width vanilla RSE/FRLG script command
prefixes reached by object/trigger event pointers across every explicitly
declared map. Its command operand roles are grounded in pinned CUBHMA
`scriptReference.txt` and `ScriptParser.cs`; its map/event pointers follow
pinned `MapModel.cs`.

The audit first revalidates canonical map-bank provenance, then deduplicates
event roots by script address. It decodes up to 16 commands/64 bytes per
distinct script, collects in-ROM pointer operands (message, movement,
trainer battle, branch, code, ASM and generic data), and groups targets
referenced by **multiple distinct operand source fields**. Repeated events
pointing to the *same* script are not incorrectly counted as multiple
independent pointer fields. Results preserve bounded ROM offsets and roles
for local inspection, with full group counts even when display is capped.

The opt-in `scanAllOperandAliases: true` local-ROM smoke flag emits
**aggregate counts only**, without script bytes, pointer offsets, file paths,
or executable patch instructions. It requires the same independent local
SHA-256 and declared vanilla bank counts as the existing smoke tool.

Limits: 4096 declared maps, 32768 event script fields, 4096 distinct
event-script roots, 65536 decoded operand fields, at most 64 commands'
worth of pointer findings per script (16 commands maximum), and bounded
display groups/references. Exceeding an audit budget fails without a
partial-atlas result. Unknown opcodes, unsupported trainerbattle variants,
terminal commands and truncation stop decoding conservatively. The scanner
does **not** traverse branches or claim a complete script graph.

An alias is only a structural clue, not evidence of allocation ownership,
safe relocation, valid target data, authenticated CUBE formats or write
permission. No ROM bytes are changed. Authentic CUBE layout evidence,
save/reopen tests, emulator and Android acceptance remain outstanding.
Strict feature parity is unchanged.
