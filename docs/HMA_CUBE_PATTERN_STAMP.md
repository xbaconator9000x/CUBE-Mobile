# CUBE pattern stamp preview

Select a rendered CUBE map cell as the source top-left, enter a target X/Y
coordinate and a width/height (1–8 per axis, at most 32 cells), then queue a
pattern copy. The stamp reads all source cells from the original 10×8 rendered
snapshot and proposes replacements for destination cells. Overlapping source
and destination rectangles do **not** cascade.

Use the existing paint-fields selector to copy both metatile and raw six-bit
collision/elevation values, tile IDs only, or high bits only. Destination
expected raw words are captured independently and the full queue is
revalidated through the same atomic virtual render preflight as rectangle and
flood-fill proposals. A stamp outside the current viewport is rejected rather
than clipped or silently partially applied.

The feature does not mutate ROM bytes, assert movement behavior, authenticate
CUBE metadata, or authorize saving. Genuine CUBE ROM/emulator/Android
save-reopen evidence is still required for strict parity.
