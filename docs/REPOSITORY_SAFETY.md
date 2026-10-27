# Public-repository tracked-file safety guard

**27 October 2026:** The repository was made public by its owner. This checkpoint adds a fail-closed CI check of **currently tracked files** for common ROM/save/patch/archive/APK/key extensions, dot-env files, non-regular files, oversized files, and high-confidence credential-like signatures. Run `npm run safety:check`.

The scan uses `git ls-files` and reads only local tracked files. It does not upload user ROMs or project data, inspect local untracked files, validate third-party dependencies, prove copyright compliance, or search historical commits. It is a defense-in-depth guard, not a comprehensive security or licence audit. If sensitive material was committed previously, removing it from the current tree alone would not erase Git history. Never add proprietary ROMs, save files, or user projects to this repository; test with synthetic buffers and independently licensed fixtures.
