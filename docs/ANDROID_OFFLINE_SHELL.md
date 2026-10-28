# Android offline shell (initial APK build)

The Android project packages the generated `app/CUBHMA_Mobile_Lab_Offline.html` as a local asset at `https://appassets.androidplatform.net/assets/index.html`, using AndroidX WebViewAssetLoader. The source remains the same as the standalone offline web app, rather than a separate fork. It does not bundle any game ROM, extracted asset, save, credential or metadata.

The Android file chooser uses `ACTION_OPEN_DOCUMENT` and accepts only files explicitly selected by the user. Android Back first uses WebView history and then returns to the workspace without unexpectedly closing the app. The host disables cleartext traffic, JavaScript file-URL access, remote navigation and network subresource loading. No Internet or broad storage permission is declared.

Run `npm run build:standalone`, then `cd android && gradle :app:assembleDebug` with Android SDK 35, JDK 17 and Gradle 8.10.2. GitHub Actions builds an unsigned-for-release, debug-signed installable APK artifact on each PR and main push. This is a development package, not a Play Store release.

**Current limitation:** Native ROM/project export is not yet implemented in this shell; Android WebView does not automatically save `blob:` URLs. The existing web workbench's semantics remain partial, and this APK build does not demonstrate authentic CUBE ROM/TOML, emulator, map-edit save/reopen or physical-device acceptance. No strict feature parity credit should be awarded merely for an APK build.
