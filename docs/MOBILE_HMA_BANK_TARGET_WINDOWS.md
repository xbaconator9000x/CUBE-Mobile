# Mobile raw bank target windows

The Named Data screen can now inspect up to four raw words at each unique aligned target of the imported metadata-declared HMA map-bank pointer table. Pinned upstream CUBHMA MapModel.cs describes bank and map subtables; this feature deliberately does not infer bank lengths, map counts, CUBE layouts, collision or event structures.

Tap a raw source word or its in-ROM pointer-shaped candidate to inspect bytes in Hex. The complete bounded second-hop evidence is reread before navigation, and ROM/metadata replacement invalidates cached findings. Overlapping, truncated, duplicate, misaligned and invalid targets are explicitly distinguished. All operations are read-only; the generated standalone offline HTML has the same controls.

Synthetic tests and generated-file checks do not authenticate a CUBE ROM. Strict feature parity remains 0/30 pending genuine ROM save/reopen, emulator, Android hardware and CUBE-specific compatibility acceptance.
