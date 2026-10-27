# Rendered map touch and raw marker checkpoint

The opt-in vanilla RSE/FRLG canvas now projects previously inspected warp/object/script/signpost coordinates as small read-only badges. A touch on a 16×16 metatile selects the matching raw blockmap source byte, behavior, layer and source attribute offset; a separate action jumps to hex. CSS scaling is converted back to native canvas pixels before hit-testing. Markers are displayed only for an exact blockmap address/dimension match.

This is not CUBE-authenticated sprite/event rendering or walkability interpretation. No collision permissions, semantic script actions or ROM writes are inferred. Replacing/editing ROM bytes or changing map selections invalidates the rendered view and selected source offset. Device/emulator acceptance remains outstanding.
