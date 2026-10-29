# Q021 — CUBE raw event scalar preflight (partial)

Pinned CUBHMA Emerald object (24-byte), trigger (16-byte) and signpost (12-byte) records now support **copy-only raw scalar field proposals** in addition to the existing position-only preflight. Supported object fields are ID, graphics, raw kind field, movement, range, trainer type, trainer range/berry ID and flag. Trigger fields are raw trigger and 32-bit index value. Signpost fields are raw kind and unused value.

Each proposal requires exact source values for every named field. The preview rejects stale fields, unsupported keys, out-of-range values and no-op changes, applies only changed bytes to a virtual reader, re-decodes the full event group, and proves that all other fields and records remain unchanged. The isolated rehearsal copies the ROM, applies the byte plan, re-decodes, rolls back and verifies full source preservation.

Script pointers, signpost raw arguments and unknown object padding are deliberately **not editable**. The new fields are raw values, not proven gameplay semantics. No file export, ROM mutation, script execution, CUBE authenticity or semantic write permission is granted. Synthetic regression tests and offline bundled-code parity cover this foundation; full mobile form integration and authentic ROM/device acceptance remain.
