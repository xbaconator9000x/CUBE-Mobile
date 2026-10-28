# Android emulator offline WebView acceptance checkpoint (29 October 2026)

A dedicated GitHub Actions workflow boots an Android API 30 x86_64 emulator, installs the debug APK and executes an instrumentation test against the **actual Android WebView**. The test waits for the generated offline HTML to load from the HTTPS WebViewAssetLoader origin and verifies that the native export bridge is injected into the loaded page. It uses no ROM, TOML or copyrighted assets. It is distinct from Node DOM mocks and Android compilation.

This smoke is **not** proof of authentic CUBE map editing, persisted semantic ROM save/reopen, game emulator compatibility, or physical Android hardware acceptance. It also does not test actual SAF provider export because that requires a controlled document provider and user picker. The 30-family strict parity gate remains 0/30 until all six independent acceptance paths are satisfied.

The initial CI emulator attempt failed at the runner infrastructure level: `/dev/kvm` existed but the runner user lacked permission, forcing slow software emulation; the Android system then died before instrumentation ran (`DeadSystemException`). The workflow now explicitly enables `/dev/kvm` access and fails early if KVM is unavailable. This is **not** an application test failure or passing emulator evidence; actual instrumentation must succeed separately.
