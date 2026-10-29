# Signed Android candidate gate (Q012 partial)

The normal pull-request/main Android workflow builds a **debug** APK. It never receives signing credentials. A separate, manually dispatched workflow, `Build verified signed Android candidate`, builds a signed release **candidate** from `main` only. This is not a production release and is not authenticated CUBE ROM compatibility.

## Setup by a repository administrator

1. Create the GitHub Actions environment `release-signing`, restrict deployments to `main` and configure required reviewers before adding secrets. This protection is an administrator responsibility; workflow YAML cannot enforce environment approval settings.
2. Set environment secrets `CUBE_RELEASE_KEYSTORE_BASE64` (base64 of a legally owned Android release keystore), `CUBE_RELEASE_STORE_PASSWORD`, `CUBE_RELEASE_KEY_ALIAS` and `CUBE_RELEASE_KEY_PASSWORD`. Do not commit or paste signing keys into PRs, artifacts or logs.
3. Set the environment variable `CUBE_RELEASE_CERT_SHA256` to the independently obtained SHA-256 fingerprint of the expected **release signing certificate** (64 hex digits, optionally colon separated). This is a public certificate identity, not a password.
4. From the repository's Actions tab, dispatch the signed candidate workflow on `main`. It fails closed if credentials, certificate pin, offline HTML, APK identity, signature scheme v2, or byte-exact package verification fail.

The workflow materializes the keystore only in temporary runner storage, signs via environment variables, checks the actual APK using Android `apksigner` and `aapt`, rechecks offline HTML bytes and excludes ROM/save assets and permissions, then uploads the verified APK with a SHA-256 provenance sidecar. Temporary signing material is deleted on completion or failure. The artifact is retained for seven days and must not be treated as a public release without additional review.

**Evidence limits:** PR CI additionally assembles and verifies a genuinely signed APK using a fresh, disposable one-day CI-only key; this validates the signing path but **not** the real release certificate or the protected dispatch workflow, which require privately configured credentials. A green signed workflow establishes package/signature identity, not genuine ROM compatibility, semantic write safety, gameplay, physical device installation or release readiness. Q012 stays pending until signed candidate and device smoke evidence are independently recorded.
