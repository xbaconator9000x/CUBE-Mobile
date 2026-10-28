# Provisional weighted engineering work baseline (28 October 2026)

This is **not an audited percentage or a delivery forecast**. It is a documented, reproducible *planning estimate* of engineering effort already completed, distinct from the strict feature-parity release gate. The baseline is deliberately low confidence. Run `npm run engineering:check` to recompute both metrics; see `parity/engineering-wbs.json` for all 30 individually sourced features and six shared workstreams.

## Scope and denominator

The 30 feature families are exactly the IDs and pinned C# paths from `parity/feature-inventory.json`, referencing `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`. The relative work units estimate **total feature-specific implementation and validation effort**, not lines of code, test counts, feature count or elapsed hours. The six additional workstreams cover *shared* ROM/metadata provenance, transaction infrastructure, Android packaging, emulator interoperability, quality/release and mobile UX. Shared platform work is excluded from individual family estimates to limit double counting.

Each workstream has an estimated completed fraction `low <= mid <= high`. The calculation is `100 * sum(effortUnits * completedFraction) / sum(effortUnits)`. The mid is a planning point estimate; low/high are judgemental scope-and-evidence sensitivity bounds, **not statistical confidence intervals**. Absent feature families receive zero credited implementation effort, even if a generic helper might later be reusable. Partial family estimates are based on the cited local tests, existing modules, and explicit gaps in `ROADMAP.md`, `FULL_PORT_PLAN.md` and `docs/PARITY_BASELINE.md`. Neither passing tests nor raw pointer counts imply a particular percentage.

This first baseline contains **286 relative effort units** across 30 feature families and six shared tracks. Its initial midpoint is approximately **10.7%** complete, with a deliberately broad **5.2–18.6%** sensitivity range and **low confidence**. These values are not externally audited, measured engineer-hours, or independent CUBE compatibility claims. They should change only with an evidence-backed reassessment of scope and effort; adding tests alone does not automatically change a fraction.

## Two independent milestones

- **Primary planning:** 50% of *estimated total engineering work*, including incomplete feature implementation, integration and testing. This is a planning milestone, **not** a release gate.
- **Secondary release validation:** at least **6 of 30 (20%) fully verified families**, each satisfying the six evidence paths in `docs/PARITY_BASELINE.md`. Current strict parity is **0/30**, regardless of engineering progress.

## Rebaseline protocol

1. Review upstream C# source and local modules, with real task breakdowns and measured implementation/acceptance effort where available.
2. Revise weights **and** completion fractions together when scope or acceptance criteria change; record the reason in the PR and retain the pinned source references.
3. Independently authenticate matching CUBE ROM/TOML versions; validate map decoding, save/reopen, emulator and Android hardware without committing ROM assets.
4. Report both metrics separately, with uncertainty, unsupported features, and any missing acceptance evidence. Do not treat the midpoint as audited until an independent source-and-effort review exists.

The README opening remains the non-descript `# Test` / `This is a test.`. Repository visibility is intentionally public; no proprietary ROM, credential, private conversation or device data belongs in source control.

## 28 October 2026: CUBE warp implementation reassessment

Following PRs #180–#182, the `warps` family's midpoint completion fraction moves from 0.24 to 0.28 (low 0.13→0.14; high 0.40→0.42). Evidence is the CUBE warp raw-field mobile/offline UI, virtual before/after arrival comparison, and isolated copy-only re-decode/rollback tests in `src/hma-cube-warp-edit-preview.js` and `tests/hma-cube-warp-edit-preview.test.mjs`. This is a **small, judgement-based increment**, not measured hours or authenticated game compatibility. The same 286 effort units and six shared workstreams remain. Persisted editing, full ownership proof, genuine save/reopen, emulator and Android acceptance remain outstanding. Strict parity remains 0/30.


## 28 October 2026: CUBE event and atomic warp core reassessment

PRs #184–#186 add multi-warp atomic combined-topology preview and copy-only rollback, source-grounded CUBE object/trigger/signpost position preflight, and atomic multi-kind event repositioning with destination co-location review. Evidence: `src/hma-cube-warp-batch.js`, `src/hma-cube-event-position.js`, `src/hma-cube-event-batch.js` and their regression tests.

The `warps` family midpoint is provisionally revised **0.28 → 0.31** (low 0.14 → 0.15, high 0.42 → 0.44). The `map-events` midpoint is revised **0.18 → 0.23** (low 0.10 → 0.11, high 0.31 → 0.35). Both are small judgement-based effort credits for additional tested core implementation, not time measurements, UI acceptance or verified CUBE compatibility. The 286-unit denominator, six shared tracks and all other fractions remain unchanged. Current rounded planning estimate: **10.9%** (sensitivity **5.3–18.7%**, low confidence). Strict accepted parity remains **0/30**. Real-ROM save/reopen, ownership authentication, emulator and Android hardware acceptance have not been demonstrated.

## 28 October 2026 — post-batch-editor reassessment

After the source-grounded CUBE warp/event mobile queue integration, optional event-array ownership census, and cross-kind isolated rollback implementation, the weighted midpoint is **11.3%** (unrounded 11.255%), with judgemental low/high sensitivity **5.4–19.1%**. Confidence remains **low**. The 286-unit denominator and 30-family parity inventory are unchanged.

The only fraction increases are for warp editing, map-event editing, pointer/ownership analysis, shared copy-only transaction infrastructure and mobile UX. These are modest proportional effort credits for tested functionality; they are **not** estimates derived from commit counts or test totals. The absence of authenticated CUBE ROM/TOML evidence, complete ownership, persisted save/reopen, emulator tests and Android hardware acceptance keeps the strict parity score **0/30**. The 50% planning and 6/30 release-validation milestones remain unmet.

## 28 October 2026 — connection and ownership integration reassessment

Following PRs #194–#198, the partial CUBE editing work now includes changed-byte ownership intersection across explicit map/event/connection claims, mobile/offline ownership diagnostics, and 12-byte raw connection record atomic preview/rollback with touchscreen queue integration. Evidence: `src/hma-cube-edit-ownership-impact.js`, `src/hma-cube-cross-bank-ownership.js`, `src/hma-cube-connection-edit.js`, `src/hma-cube-batch-mobile.js` and their corresponding regression tests.

The `pointers` midpoint fraction changes **0.17 → 0.19**, `warps` **0.34 → 0.37**, shared `transaction-platform` **0.14 → 0.15**, and shared `mobile-ux-accessibility` **0.19 → 0.20**. Low/high bounds are also adjusted modestly for the same source-grounded work. All 30 family weights, six shared tracks and the **286 relative-unit denominator** remain unchanged. The recomputed planning midpoint is **11.5%**, with sensitivity **5.5–19.4%** and **low confidence**. This is an expert judgemental effort reassessment, **not measured engineer-hours, independently audited completion, or a tenfold throughput claim**.

No additional strict parity is accepted: **0/30** families pass the six-evidence gate. Global pointer/alias coverage, genuine CUBE ROM/TOML identity, safe persisted save/reopen, emulator validation and Android hardware testing remain missing. The 50% engineering planning milestone and 6/30 strict release-validation milestone remain unmet.
