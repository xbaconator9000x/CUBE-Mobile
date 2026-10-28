# CUBE viewport flood-fill preview

The CUBE Emerald rendered map canvas now supports a **four-neighbor flood fill**
from the selected cell. Choose either matching metatile ID (ignores high bits)
or matching the complete raw 16-bit cell word. The proposed metatile and raw
high bits are applied only to a **virtual 10 × 8 viewport preview**.

- The fill visits only connected cells in the currently rendered viewport.
  A fill touching its edge may continue off-screen; pan and inspect separately.
- A fill of more than 32 cells fails completely rather than silently truncating.
  It cannot partially update the proposal queue.
- Every proposal carries its exact original 16-bit word. Queue preflight
  rechecks all originals, full render pixels, map structure and existing queue
  before accepting the combined changes.
- The current queue remains at most 32 cells. It can be cleared or individual
  proposals removed; all modifications are preview-only.
- Tile/high-bit matching is not a walkability or behavior inference.
  CUBE ROM authenticity, exclusive map ownership, save/reopen, emulator and
  Android device acceptance remain unverified. No semantic ROM writes.

Implementation: src/hma-cube-cell-batch.js and tests/hma-cube-flood-fill.test.mjs.
