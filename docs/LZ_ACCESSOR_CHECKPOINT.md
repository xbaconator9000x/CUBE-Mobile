# LZ10 accessor checkpoint (27 October 2026)

Graphics previews and LZ10 scans now use the staged ROM read accessor, without allocating full-ROM snapshots for decoding or scanning. Decompression output remains capped at 512 KiB; candidate scanning remains bounded and unverified. No semantic ROM writes or CUBE layout assumptions are introduced.

Synthetic tests check array/accessor equivalence, staged reads, overlapping references, chunk-boundary candidates, truncation and invalid bytes. The standalone HTML mirrors the modular source. Save As and patch application intentionally still allocate output copies. Large-ROM Android responsiveness and actual map/metatile rendering remain unverified.
