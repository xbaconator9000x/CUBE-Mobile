# Android offline shell (initial APK build)

The Android project packages the generated `app/CUBHMA_Mobile_Lab_Offline.html` as a local asset at `https://appassets.androidplatform.net/assets/index.html`, using AndroidX WebViewAssetLoader. The source remains the same as the standalone offline web app, rather than a separate fork. It does not bundle any game ROM, extracted asset, save, credential or metadata.

The Android file chooser uses `ACTION_OPEN_DOCUMENT` and accepts only files explicitly selected by the user. Android Back first uses WebView history and then returns to the workspace without unexpectedly closing the app. The host disables cleartext traffic, JavaScript file-URL access, remote navigation and network subresource loading. No Internet or broad storage permission is declared.

Run `npm run build:standalone`, then `cd android && gradle :app:assembleDebug` with Android SDK 35, JDK 17 and Gradle 8.10.2. GitHub Actions builds an unsigned-for-release, debug-signed installable APK artifact on each PR and main push. This is a development package, not a Play Store release.

**Native export:** The Android host intercepts user-triggered `blob:` downloads from the trusted offline app origin, requests an explicit `ACTION_CREATE_DOCUMENT` destination, streams bounded 48 KiB base64 chunks with per-chunk acknowledgments, closes and reopens the selected document, and verifies its exact length and SHA-256. Failures attempt to remove the partial SAF document. Android document providers are not guaranteed atomic; users should retain source backups. This exports existing web-workbench bytes, including user-staged raw edits, **not** verified CUBE semantic edits. The bridge accepts messages only from the trusted main frame and cannot read arbitrary device files. The maximum export is 128 MiB.

**Current limitations:** Authentic CUBE ROM/TOML compatibility, full map-script/editor parity, verified edited-ROM save/reopen, emulator execution and physical-device acceptance are still missing. A successful debug APK build is not proof of hardware behavior or strict feature parity.

## Android 13+ Back and export lifecycle

The native host registers a platform `OnBackInvokedCallback` on API 33+ while retaining the legacy Back override on older Android versions. Both route through the same WebView-history-first, workspace-fallback handler, rather than allowing an accidental Activity exit. Main-frame navigation away from the bundled app aborts any pending native export and attempts partial-document cleanup. Top-level navigation is restricted to the bundled `index.html` and its hash routes. These are source-level safeguards and APK compile checks; real gesture, keyboard and device lifecycle acceptance remains outstanding.

## SAF export session and source-document protection

Each Android blob export now carries a session ID across native picker, chunk ACK, finish, cancellation and readback-complete callbacks. A delayed callback from an earlier export cannot advance or cancel the current export. The WebView keeps its export lock until native SHA-256 readback completes; a 48px-minimum touch cancellation control remains visible during export. A page reload cancels the native session. This protocol has Node-based synthetic regression tests, but has not yet been exercised on a physical Android device.

The host also records exact content URIs selected through its import picker and refuses to open a matching URI as an export destination. This is defense in depth against a document provider returning an already imported source URI despite the normal fresh-document contract of `ACTION_CREATE_DOCUMENT`. **URI equality is not proof of different underlying storage**: aliases or providers returning distinct URIs for the same file cannot be ruled out. Users must retain original ROM backups. If SAF deletion fails after a partial export, the host now explicitly warns that an incomplete document may remain instead of claiming successful rollback. Android document-provider writes are not atomic and no semantic CUBE write authority is established.

## Android picker lifecycle and session isolation (29 October 2026)

A cancelled WebView export does not imply that the external Android document picker has returned. The native host now retains a one-result picker ticket across WebView reload/cancel, rejects new exports while that result is outstanding, and consumes stale results without binding them to a later session. Cryptographically randomized 16-digit per-export session identifiers avoid reuse across page loads. Plain Java unit tests exercise picker-ticket reuse and duplicate rejection; the JS protocol tests exercise cross-page session uniqueness. These are source/CI tests, **not** physical Android or emulator acceptance. No ROM edit permission is granted.

## Nonblocking Android SAF readback verification (29 October 2026)

The Android export host now streams the final document readback and SHA-256 verification on a dedicated worker rather than the WebView/UI callback thread. It accepts only an exact-length, matching digest; truncated, expanded, corrupted or unreadable documents fail closed. A cancelled/reloaded export invalidates the worker result, and activity destruction shuts the worker down. The native picker ticket remains independent of this readback lifecycle. Pure Java tests exercise exact, corrupt, truncated, expanded, empty and failed-provider streams. This is not physical device or real SAF provider acceptance and does not enable CUBE semantic ROM writes.

## Per-chunk source Blob integrity (29 October 2026)

Before exporting each bounded 48 KiB Blob slice, the Android-only bridge computes its WebCrypto SHA-256. The native host independently hashes the decoded bytes and refuses mismatches before writing that chunk. The native end-to-end reopened-document digest still verifies the saved result. This avoids a full-ROM JS hash allocation while checking both source-to-native transfer and native-to-provider readback. Synthetic JS and pure Java tests cover matching and corrupted chunks. This is not proof of a trustworthy source ROM, provider atomicity, CUBE semantic writes or physical-device acceptance.

## Empty-document preflight before SAF export (29 October 2026)

Before opening any potentially truncating provider output stream, the Android host reopens the selected ACTION_CREATE_DOCUMENT URI read-only and requires a zero-byte stream. Nonempty or unreadable targets are refused **without deletion**, reducing the risk of an alias to an imported ROM that has a different URI. An empty target is not proof of a unique file, so URI aliasing remains a documented limitation. Abort cleanup only attempts deletion after a write was attempted; an untouched empty document may remain and is reported accurately. Pure Java tests cover empty, nonempty and unreadable providers. Real provider/device behavior remains unverified.
