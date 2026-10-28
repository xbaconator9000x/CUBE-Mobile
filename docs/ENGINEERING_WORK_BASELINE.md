# Provisional weighted engineering work baseline (28 October 2026)

This is **not an audited percentage or a delivery forecast**. It is a documented, reproducible *planning estimate* of engineering effort already completed, distinct from the strict feature-parity release gate. The baseline is deliberately low confidence. Run `npm run engineering:check` to recompute both metrics; see `parity/engineering-wbs.json` for all 30 individually sourced features and six shared workstreams.

## Scope and denominator

The 30 feature families are exactly the IDs and pinned C# paths from `parity/feature-inventory.json`, referencing `kcradi/CUBHMA@3044393183e01af2ae1e907fb37e4a75eda6a8dc`. The relative work units estimate **total feature-specific implementation and validation effort**, not lines of code, test counts, feature count or elapsed hours. The six additional workstreams cover *shared* ROM/metadata provenance, transaction infrastructure, Android packaging, emulator interoperability, quality/release and mobile UX. Shared platform work is excluded from individual family estimates to limit double counting.

Each workstream has an estimated completed fraction `low <= mid <= high`. The calculation is `100 * sum(effortUnits * completedFraction) / sum(effortUnits)`. The mid is a planning point estimate; low/high are judgemental scope-and-evidence sensitivity bounds, **not statistical confidence intervals**. Absent feature families receive zero credited implementation effort, even if a generic helper might later be reusable. Partial family estimates are based on the cited local tests, existing modules, and explicit gaps in `ROADMAP.md`, `FULL_PORT_PLAN.md` and `docs/PARITY_BASELINE.md`. Neither passing tests nor raw pointer counts imply a particular percentage.

This first baseline contains **286 relative effort units** across 30 feature families and six shared tracks. Its initial midpoint is approximately **10.6%** complete, with a deliberately broad **5.2–18.5%** sensitivity range and **low confidence**. These values are not externally audited, measured engineer-hours, or independent CUBE compatibility claims. They should change only with an evidence-backed reassessment of scope and effort; adding tests alone does not automatically change a fraction.

## Two independent milestones

- **Primary planning:** 50% of *estimated total engineering work*, including incomplete feature implementation, integration and testing. This is a planning milestone, **not** a release gate.
- **Secondary release validation:** at least **6 of 30 (20%) fully verified families**, each satisfying the six evidence paths in `docs/PARITY_BASELINE.md`. Current strict parity is **0/30**, regardless of engineering progress.

## Rebaseline protocol

1. Review upstream C# source and local modules, with real task breakdowns and measured implementation/acceptance effort where available.
2. Revise weights **and** completion fractions together when scope or acceptance criteria change; record the reason in the PR and retain the pinned source references.
3. Independently authenticate matching CUBE ROM/TOML versions; validate map decoding, save/reopen, emulator and Android hardware without committing ROM assets.
4. Report both metrics separately, with uncertainty, unsupported features, and any missing acceptance evidence. Do not treat the midpoint as audited until an independent source-and-effort review exists.

The README opening remains the non-descript `# Test` / `This is a test.`. Repository visibility is intentionally public; no proprietary ROM, credential, private conversation or device data belongs in source control.
