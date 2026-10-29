# Android SAF export abort and recovery safety

**Status: partial Q018. Device-provider acceptance remains outstanding.**

The native export bridge writes only to an explicit user-selected `ACTION_CREATE_DOCUMENT` destination after a bounded empty-document preflight. It checks imported-document aliases, chunk hashes and final SHA-256 readback.

An Android document provider can return an existing zero-byte document alias even when the app requests creation. Successful picker selection, zero-byte preflight and a subsequent write **do not prove exclusive ownership** of that provider URI. Automatically calling `ContentResolver.delete` during cancellation, WebView reload, Activity teardown or failed verification could destroy user-owned data.

`NativeExport.abort` now closes its stream, cancels any verification task, clears the session and notifies the user that an empty or partial document may remain. It **never automatically deletes the selected document**. Users can inspect and remove incomplete files themselves through their provider. The original imported ROM is never a valid export target when its URI or a recognized alias is protected by `ImportedDocumentGuard`.

This is a conservative tradeoff: aborted exports may leave incomplete documents, but the app does not pretend to have performed an ownership-safe destructive rollback. Native session cleanup and cancellation remain in place.

The source safety regression is `tests/android-saf-abort-safety.test.mjs`; Android CI compiles the host. A real physical-device test across multiple SAF providers, process recreation, cancellation and provider failures is still required. This change does not authenticate CUBE layouts, authorize semantic writes or establish strict feature parity.

## Import picker result ownership across WebView reloads

The native `ACTION_OPEN_DOCUMENT` import chooser now has its own outstanding-result gate. A WebView reload cancels the previous JavaScript file callback **without releasing the Android picker ticket**. While that picker is still outstanding, a new chooser is rejected rather than allowing the old result to be delivered to a newer callback. The old result consumes its ticket and is discarded. Activity recreation persists only the outstanding-ticket bit; it never restores a stale WebView callback. Picker launch failures clear the ticket and cancel the callback.

`ImportPickerGate` has pure Java JUnit tests for reload, recreation, overlapping pickers and duplicate results. Source wiring tests ensure the MainActivity result path consumes the gate before forwarding selected URIs. No imported ROM data or private URI is stored in the repository. This is a lifecycle safety improvement, not physical-device SAF acceptance; picker cancellation, provider differences and process death still require real Android testing.
