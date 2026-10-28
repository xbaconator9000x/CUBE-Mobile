# Touch-to-edit CUBE event records

After inspecting a declared CUBE custom map's raw event arrays, each warp, object, script trigger and signpost row now provides an **Edit … position (copy-only)** action. It re-decodes the entire source event group against the exact current inspection, fills the corresponding warp or event batch-editor index/kind, loads the original fields and scrolls the control into view. The original hex-navigation button remains available.

This removes the need to manually transcribe event indices on Android touchscreens. No edit is queued automatically; the user must explicitly change fields, queue, preview and rehearse rollback. The same behavior is generated into the standalone offline HTML. Stale inspections fail closed. No ROM save or CUBE parity acceptance is implied.
