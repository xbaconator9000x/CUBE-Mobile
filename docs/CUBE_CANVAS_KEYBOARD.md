# CUBE rendered map keyboard and touch parity

The read-only CUBE Emerald map canvas is now keyboard focusable in both the modular web app and generated offline Android WebView page. Its visible focus ring and accessible label describe the interaction.

Use arrow keys to move one metatile within the current 10 × 8 viewport; Enter or Space inspects the selected cell. The initial keyboard selection starts at the top-left cell. Arrow navigation clamps to the viewport and does not scroll the surrounding page.

Keyboard selection deliberately dispatches through the **same existing canvas click handler** as touch. This retains the current ROM snapshot, map layout, overlay and raw byte/attribute revalidation before showing offsets or enabling read-only change proposals. It does not create a weaker keyboard-only editing path or infer walkability. Re-rendering or changing the ROM invalidates the selection as before.

The unit harness in `tests/mobile-cube-canvas-keyboard.test.mjs` exercises keyboard coordinates, bounds, stale/hidden view refusal, Enter/Space and modular/offline parity. Physical Android keyboard, accessibility-service and touch-device acceptance remain outstanding; this is partial Q019 progress, not independent strict parity or semantic write authorization.
