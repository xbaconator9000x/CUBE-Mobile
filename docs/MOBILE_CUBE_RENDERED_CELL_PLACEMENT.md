# Touch placement from rendered CUBE map cells

Load a CUBE warp or object/trigger/signpost in its copy-only batch editor. Tap a rendered map cell, then select **Use selected rendered cell** beside the loaded record. The UI fills the proposed X/Y coordinates, preserving the elevation and other raw fields until explicitly changed. The user must still queue and verify the proposal; no ROM bytes are written.

The selection is revalidated against the exact current CUBE map, ROM, rendered cells, attributes, source byte offset, raw cell word and every rendered pixel. Changing ROM, metadata, map, viewport or cell bytes invalidates stale selection. This supports the modular mobile web app and generated offline HTML.

Collision and high-bit semantics, event co-location safety, authentic CUBE compatibility, persisted save/reopen, emulator behavior and Android device acceptance remain unverified. This is a touch-UX improvement, not strict feature parity.
