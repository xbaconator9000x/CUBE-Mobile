# Typed queued map-change preflight (vanilla only)

The mobile and offline applications can now inspect a queued set of vanilla RSE/FRLG blockmap, warp, object, script-trigger and signpost changes through an immutable reviewed-byte overlay. The **Verify typed queued preview (no writes)** button requires a declared map atlas, a current queue and matching atlas inputs. It rechecks original bytes, every declared structural owner, exact decoded before/after field values and raw warp arrival status. Cross-structure overlaps, forged provenance, stale inputs and truncated owner lists fail closed.

This is **not** a ROM write, undo transaction, save/reopen roundtrip, relocation audit, verified walkability rule, authenticated CUBE format, or emulator/device acceptance. A green typed preview must never be used as permission to apply changes to an unverified ROM. Only user-selected, explicitly declared vanilla structures are inspected. No ROM or patch bytes are exported by this preflight.

The result displays changed typed fields and affected bank/map owners; tap an entry to inspect its original ROM offset in the hex view. Changing the ROM, atlas or queued previews invalidates the result. Synthetic tests cover shared blockmaps, warp arrival, event coordinates, structural conflicts, stale bytes and offline bundling.
