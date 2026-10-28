# CUBE visible-cell replacement preview

Select a rendered cell, choose matching by metatile ID, raw six-bit
collision/elevation value, or exact 16-bit cell word, and choose whether to
paint both fields, tile IDs only or high bits only. **Replace all matching
visible cells** queues changes to every matching cell in the current 10×8
rendered viewport, including disconnected regions.

Unlike four-neighbor flood fill, this does not require adjacent matches. The
entire result must fit the existing 32-cell budget or it is rejected without
modifying the queue. Every proposal carries its exact destination original
word; queue preflight rechecks original bytes, rendered pixels, map structure
and combined queue before accepting.

The operation is a virtual preview only. It does not infer walkability, edit
the ROM, authenticate CUBE layouts, or prove emulator/Android save-reopen.
