# Android SAF export abort and recovery safety

**Status: partial Q018. Device-provider acceptance remains outstanding.**

The native export bridge writes only to an explicit user-selected `ACTION_CREATE_DOCUMENT` destination after a bounded empty-document preflight. It checks imported-document aliases, chunk hashes and final SHA-256 readback.

An Android document provider can return an existing zero-byte document alias even when the app requests creation. Successful picker selection, zero-byte preflight and a subsequent write **do not prove exclusive ownership** of that provider URI. Automatically calling `ContentResolver.delete` during cancellation, WebView reload, Activity teardown or failed verification could destroy user-owned data.

`NativeExport.abort` now closes its stream, cancels any verification task, clears the session and notifies the user that an empty or partial document may remain. It **never automatically deletes the selected document**. Users can inspect and remove incomplete files themselves through their provider. The original imported ROM is never a valid export target when its URI or a recognized alias is protected by `ImportedDocumentGuard`.

This is a conservative tradeoff: aborted exports may leave incomplete documents, but the app does not pretend to have performed an ownership-safe destructive rollback. Native session cleanup and cancellation remain in place.

The source safety regression is `tests/android-saf-abort-safety.test.mjs`; Android CI compiles the host. A real physical-device test across multiple SAF providers, process recreation, cancellation and provider failures is still required. This change does not authenticate CUBE layouts, authorize semantic writes or establish strict feature parity.
