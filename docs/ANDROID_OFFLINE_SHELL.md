# Android offline shell (initial APK build)

The Android project packages the generated `app/CUBHMA_Mobile_Lab_Offline.html` as a local asset at `https://appassets.androidplatform.net/assets/index.html`, using AndroidX WebViewAssetLoader. The source remains the same as the standalone offline web app, rather than a separate fork. It does not bundle any game ROM, extracted asset, save, credential or metadata.

The Android file chooser uses `ACTION_OPEN_DOCUMENT` and accepts only files explicitly selected by the user. Android Back first uses WebView history and then returns to the workspace without unexpectedly closing the app. The host disables cleartext traffic, JavaScript file-URL access, remote navigation and network subresource loading. No Internet or broad storage permission is declared.

Run `npm run build:standalone`, then `cd android && gradle :app:assembleDebug` with Android SDK 35, JDK 17 and Gradle 8.10.2. GitHub Actions builds an unsigned-for-release, debug-signed installable APK artifact on each PR and main push. This is a development package, not a Play Store release.

**Native export:** The Android host intercepts user-triggered `blob:` downloads from the trusted offline app origin, requests an explicit `ACTION_CREATE_DOCUMENT` destination, streams bounded 48 KiB base64 chunks with per-chunk acknowledgments, closes and reopens the selected document, and verifies its exact length and SHA-256. Failures attempt to remove the partial SAF document. Android document providers are not guaranteed atomic; users should retain source backups. This exports existing web-workbench bytes, including user-staged raw edits, **not** verified CUBE semantic edits. The bridge accepts messages only from the trusted main frame and cannot read arbitrary device files. The maximum export is 128 MiB.

**Current limitations:** Authentic CUBE ROM/TOML compatibility, full map-script/editor parity, verified edited-ROM save/reopen, emulator execution and physical-device acceptance are still missing. A successful debug APK build is not proof of hardware behavior or strict feature parity.

## Android 13+ Back and export lifecycle

The native host registers a platform `OnBackInvokedCallback` on API 33+ while retaining the legacy Back override on older Android versions. Both route through the same WebView-history-first, workspace-fallback handler, rather than allowing an accidental Activity exit. Main-frame navigation away from the bundled app aborts any pending native export and attempts partial-document cleanup. Top-level navigation is restricted to the bundled `index.html` and its hash routes. These are source-level safeguards and APK compile checks; real gesture, keyboard and device lifecycle acceptance remains outstanding.
