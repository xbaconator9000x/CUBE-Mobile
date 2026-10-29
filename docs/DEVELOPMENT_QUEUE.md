# CUBE Mobile persistent development queue

GitHub `main:queue/development.json` is the authoritative queue; this is NOT a replacement for `parity/engineering-wbs.json` or strict parity acceptance. `queue/next-batch.json` is a disposable derived artifact and should not be committed. Queue work-hour estimates are provisional planning units, not measured productivity or total project hours.

Run `node scripts/development-queue.mjs` for the next dependency-eligible, path-disjoint batch. The scheduler rejects cycles, unknown dependencies, duplicate IDs and premature completion. It does not automatically write to main or claim verified completion. Before starting a task, create a branch, record `in_progress`, branch and owner in a queue PR/checkpoint; after CI and integration, mark `done` with evidence and merged commit. Failed tasks remain `failed` with diagnostic checkpoint; other independent tasks remain eligible. Use branch PRs and GitHub CI as the safe integration boundary.

For concurrent work, use disjoint `paths` and separate branches; avoid committing competing queue edits without rebasing against main. A single queue integrator serializes queue updates. After interruption, inspect main, open PRs and CI before reconciling; never assume an in-progress task is complete. `blocked` requires a concrete blocker and does not block independent work.

The **persistent queue validation workflow** only validates scheduling and uploads an ephemeral next-batch report; it does not write code. The separate opt-in [continuous Codex worker](CONTINUOUS_CODING_WORKER.md) can execute selected tasks, test changes, create PRs, dispatch branch CI, and chain immediately after a verified merge. It is disabled until repository Actions variable and API credentials are configured; do not claim it is running before an actual dispatch succeeds. The hourly ChatGPT watchdog remains the recovery path. For verified completion, preserve test logs, authenticated ROM compatibility evidence and Android results, excluding ROM binaries and secrets from Git.

Initial tasks reflect the repository's current structural and editing modules and upstream provenance. `done` means prerequisite infrastructure exists, not independently verified feature parity. The most important blocked dependency is authenticated local CUBE ROM/manifest validation. Continue parallel Android packaging, BPS infrastructure, and other non-conflicting tasks where possible.

Independent, dependency-eligible engineering tasks Q016–Q019 provide useful work even while Q003 genuine ROM evidence remains blocked. Q020 tracks the external Codex worker activation requirement. These are provisional queue planning hours, not additional independently accepted parity or an increase in the 286-unit WBS estimate.

## 2026-10-29 dependency and throughput checkpoint

Q016 and Q017 are blocked for **external acceptance evidence**, not because their partial source implementations have been erased: their remaining tests require an independently authenticated, legally held CUBE ROM/ordered TOML profile, physical Android SAF behavior and/or emulator gameplay save/reopen. Do not repeatedly create low-value polish PRs to simulate completing these gates. Resume those tasks when the evidence is available.

Q021–Q025 are independent, dependency-eligible implementation batches covering typed CUBE event records, script-reference navigation, cross-bank ownership, combined transaction verification and Android instrumentation. These tasks do **not** bypass Q003 or authorize semantic ROM writes. Prefer them to re-auditing completed BPS/provenance safeguards. Each must add source-grounded implementation, tests and evidence, with separate branches for disjoint paths. The queue may grow as new source-backed feature families are discovered; its planning hours are not a total-project estimate.

Continue toward full release readiness rather than stopping at a 20% parity milestone. GitHub main, reviewed green PRs, and the weighted engineering WBS remain separate authorities for task state, integration and estimated completion respectively.
