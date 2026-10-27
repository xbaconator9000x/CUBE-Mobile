# Reproducible CUBHMA → CUBE Mobile feature-parity baseline

**Date:** 27 October 2026. **Pinned upstream:** [kcradi/CUBHMA at 3044393183e01af2ae1e907fb37e4a75eda6a8dc](https://github.com/kcradi/CUBHMA/tree/3044393183e01af2ae1e907fb37e4a75eda6a8dc).

The upstream Git tree was inspected to ground 30 feature families in actual C# source paths. The complete inventory and reproducible scoring logic are in `parity/feature-inventory.json` and `scripts/parity-audit.mjs`. Run `npm run parity:check`.

**Strict fully verified parity: 0 / 30 = 0%.** This is not a claim that no functionality exists. The mobile code already provides several useful *partial* read-only inspections and a raw byte workbench, but no complete desktop feature family has independently documented authentic ROM roundtrip, emulator, Android hardware, and CUBE-specific compatibility acceptance. A passing synthetic unit test or a read-only viewer does not count as full parity.

A feature can change from `partial` to `verified` only when all six evidence paths exist: mobile UI, automated tests, authentic ROM edit/save/reopen roundtrip, emulator report, Android hardware report, and CUBE version/layout compatibility report. The audit script rejects a verified claim without every evidence file. These paths must be reviewed independently; their existence alone is not a substitute for verifying their contents. `absent` means no independently evidenced functional port in the current checkpoint, not that no shared code exists.

The 20% target is at least **6 fully verified families out of 30**, without changing the denominator to inflate progress. Prioritize source-grounded map discovery, map rendering, collision/warp/event editing and safe roundtrips, then scripts and typed tables. No CUBE/ROM authentication or safe semantic writes are currently established. Do not count synthetic fixtures as authentic ROM compatibility, and never commit proprietary ROMs or private project data.

This is a **source-grounded baseline, not an external third-party certification**. A future independent reviewer should confirm upstream coverage, inspect each evidence artifact, test supported devices and versions, and approve the status changes before using the percentage as an acceptance claim.
