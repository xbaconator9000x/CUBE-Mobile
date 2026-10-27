# Vanilla event-script branch pointer audit

The bounded, read-only `auditVanillaScriptBranchTargets` helper uses
`inspectVanillaScriptCommandPrefix` to review **only** decoded
`call`, `goto`, `if1` and `if2` pointer operands from the pinned
CUBHMA vanilla event-script reference. It records the source ROM offset,
raw pointer and, when conventional and in-bounds, target ROM offset.

Statuses distinguish an exact command start in the decoded prefix,
a pointer into the middle of a decoded command, an in-ROM pointer outside
the bounded decoded prefix, an out-of-ROM pointer, a non-ROM pointer and
a null pointer. A pointer outside the prefix is **unresolved**, not
invalid. A pointer into a decoded command is only a structural review hint,
not proof of a runtime defect or executable ownership.

The audit never follows pointers, traverses branches, executes scripts,
reads ASM as event commands, infers complete script length, or writes a ROM.
It is not CUBE-authenticated and does not affect strict feature parity.
