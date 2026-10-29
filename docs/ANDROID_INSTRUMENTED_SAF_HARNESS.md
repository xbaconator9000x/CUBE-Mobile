# Android instrumented content-provider and accessibility smoke

`SafRoundtripTest` runs in the real Android emulator alongside existing offline WebView and Back-navigation instrumentation.

- Creates a disposable **synthetic** 32,769-byte document through Android's scoped `MediaStore.Downloads` content provider, writes it, reopens it, verifies exact length and SHA-256 through the production `ExportReadback` implementation, then checks incorrect-length and incorrect-digest rejection.
- Uses the actual returned content URI to exercise `ImportedDocumentGuard` import identity protection, saved-state restoration and fail-closed invalidation. The test deletes its disposable document in `finally`.
- Starts the actual offline Android `MainActivity` and waits for WebView to expose named Help/Home controls, a labeled ROM file picker, and the live ROM-fingerprint status region. This is a DOM-level accessibility smoke, not a TalkBack or touch-target audit.

This is **not** an external `ACTION_OPEN_DOCUMENT` / `ACTION_CREATE_DOCUMENT` picker test, a third-party/cloud SAF provider test, a native export bridge end-to-end test, an authenticated ROM save/reopen test or physical-device acceptance. It neither packages ROMs nor enables semantic writes. Those release gates remain open.

Run via `cd android && gradle :app:connectedDebugAndroidTest` on a configured emulator (the existing Android emulator workflow runs this task). The content-provider case requires Android 10+; older devices skip that case.
