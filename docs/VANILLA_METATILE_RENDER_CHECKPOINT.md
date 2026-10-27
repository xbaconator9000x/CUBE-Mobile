# Vanilla metatile compositor — 27 October 2026

A bounded, read-only 16×16 RSE/FRLG compositor decodes two 4bpp tilesets (raw or LZ10), 13 palette banks, 16-byte metatile descriptors, 512/640 block and tile splits, tile flips, two layers and the third-layer extension. Raw collision/elevation is preserved separately. It requires an explicit vanilla map header and is not CUBE-authenticated. Synthetic tests cover colour banks, staged reads, immutability and malformed layouts. No semantic writes, walkability claims, or Android/emulator acceptance.
