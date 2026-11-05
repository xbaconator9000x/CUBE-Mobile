# CUBE-Mobile Android preview-first delivery

User-authorised priority: deliver an installable, usable ARM64 Android Preview APK before completing extensions and polishing every bug. Copilot implements; ChatGPT supervises. Aim for a first preview in hours if existing source and free build capacity permit; this is a target, not a guarantee.

## First preview acceptance
- Inspect the actual current application and preserve existing functional capabilities; do not substitute a mock-only demo.
- Portrait-first Android phone UI: simple Home/Open/Browse/Settings navigation appropriate to the actual app, readable layout and large touch targets, safe areas, clear loading and errors, back handling, collapsible panels, and no desktop-width controls overflowing narrow screens.
- Real Android launch, import/open/browse of supported files and read-only exploration where implemented; label unsupported or unverified functionality honestly.
- Produce a downloadable ARM64 APK from the existing build workflow with SHA-256 and exact source SHA, build provenance, signing/install instructions and known limitations.
- Keep unsafe write/export paths disabled or clearly experimental until backups, integrity and round-trip validation pass. Separate basic preview release gate from full feature acceptance; never weaken existing regression tests.

## Delivery approach
One Copilot agent, one integrated PR; user authorises approximately 5x larger cohesive batches (20–40 related changes and 4–8 substantial commits/stages as appropriate), with internal test/fix cycles. Fix actual defects rather than reporting only planning or synthetic tests. Run source tests and Android emulator UI smoke when free quota allows; distinguish source, Android functional and APK compilation acceptance. Diagnose failures and continue without repeated prompts.

## Hard constraints
Strict $0 paid overages, no paid APIs, no Pro+, no premium runners, no unlicensed/private assets, no public publication of user project data. Check available free GitHub Actions capacity before running workflows; if exhausted, do not spend money or run costly CI. Use the existing repo and this PR, not new competing agents or issues.
