# CUBE changed-cell event impact — preview-only

The mobile CUBE multi-cell visual preview now inspects raw event coordinates
for each **actually changed** blockmap cell. It reports the number of object,
warp, script-trigger and signpost records occupying those cells. Each finding
retains the source event kind, index and ROM offset, and indicates whether
the proposed change affects the metatile ID, six high bits, or both.

If an event array cannot be decoded safely, the preview explicitly says
**event table unavailable; impact unknown**, rather than reporting a clean
zero-event result. This information is visible in the mobile and offline
batch-preview status.

The underlying CUBE `BlockCell` encoding is `(Collision << 10) | Tile`
in pinned CUBHMA `MapModel.cs`. The six high bits are raw editor data:
the preview does not infer whether an event or tile is walkable, whether
a warp will execute, or whether a ROM can be safely saved.

This is a safety review improvement, **not** semantic writing, ROM
authentication, exclusive ownership proof or strict feature-parity credit.
