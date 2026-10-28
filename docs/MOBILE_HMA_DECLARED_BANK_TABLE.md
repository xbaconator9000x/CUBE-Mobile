# Mobile declared CUBE map-bank pointer explorer

The Named Data screen can now display **every fixed pointer slot declared by the imported `data.maps.banks` TOML format**, rather than an arbitrary 16-word preview. Pinned CUBHMA Emerald metadata declares `[maps<...>]34`; the interface displays 34 raw source words when the staged ROM contains the declared span.

Each slot exposes its exact ROM source byte offset, raw 32-bit value, optional conventional in-ROM target and repeated-target hint. Aggregate counts cover pointer-shaped words, duplicates, misalignment and pointers back into the table. The user can tap either source or target to inspect bytes in Hex. The entire table is freshly reread and compared before any navigation; changing ROM or TOML metadata invalidates cached evidence.

The count is a **metadata declaration**, not independent authentication of CUBE ROM bytes, bank entry types, number of maps, or allocation ownership. Malformed/dynamic formats, conflicting metadata, out-of-ROM spans and invalid readers fail closed. This is a read-only inspection feature in both the modular mobile UI and standalone offline HTML.

Acceptance still requires independently verified ROM+metadata fingerprints, actual custom bank/layout decoding, safe save/reopen, emulator and Android hardware tests. No strict parity credit is claimed.
