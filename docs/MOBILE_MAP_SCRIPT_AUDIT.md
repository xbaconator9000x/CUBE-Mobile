# Mobile vanilla map event-script audit

The Blockmaps screen now provides **Audit all vanilla map event script prefixes (read only)** for a selected vanilla RSE/FRLG map header. It inspects up to 32 object/trigger script pointer fields, decoding at most 64 bytes and 16 conservative commands per in-ROM script. It reports pointer statuses, decoded-prefix stop reasons, branch-pointer counts and typed operand-pointer counts. It never follows script branches, executes code or exports raw script contents.

The mobile and standalone views offer exact pointer-source and conventional in-ROM target navigation. Every navigation checks the ROM/map selection and recomputes the bounded script audit to reject stale event pointers. Unsupported/unknown commands stop decoding, and totals explicitly identify truncated records.

**Limitations:** This is a vanilla format hint, not CUBE grammar, script ownership, executable validity, full script length or safe write authority. Authentic ROM save/reopen, emulator and Android hardware acceptance remain outstanding; no strict parity credit is awarded. See [local script audit](LOCAL_SCRIPT_AUDIT.md) and pinned [CUBHMA script reference](https://github.com/kcradi/CUBHMA/blob/3044393183e01af2ae1e907fb37e4a75eda6a8dc/src/HexManiac.Core/Models/Code/scriptReference.txt).
