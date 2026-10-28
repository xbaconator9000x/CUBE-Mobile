# Read-only CUBHMA map-bank raw pointer window

After importing metadata containing an unambiguous, in-bounds `data.maps.banks` anchor, the Named Data screen can inspect a **16-word raw window** starting at that declared offset. It shows each exact source offset, raw little-endian 32-bit value and conventional GBA pointer candidate (when in ROM bounds). Source and target buttons jump to the hex inspector after **re-reading and comparing current staged ROM bytes**.

The window has a strict 32-word API ceiling, rejects truncated or invalid reads, and never edits the ROM. The mobile UI defaults to 16 words and requires the entire window to fit. Results are invalidated when metadata or ROM bytes change.

These are **raw words**, not verified bank pointers, bank counts, map headers or CUBE custom structures. This feature does not authenticate metadata overlays or CUBE ROM fingerprints, parse the custom format DSL, or authorize semantic writes. Strict CUBHMA/CUBE parity remains **0/30** until genuine ROM, emulator and Android acceptance gates pass.
