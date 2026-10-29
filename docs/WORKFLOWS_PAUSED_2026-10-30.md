# Temporary GitHub Actions hold — 2026-10-30

User requested that CUBE-Mobile pause to avoid unintended GitHub resource/API usage.
All automatic push and pull-request workflow triggers on main have been replaced with manual-only `workflow_dispatch`.
Continuous CUBE coding worker is also manual-only; API-enabled coding worker is not auto-started by pushes.
Signed candidate build was already manual-only and is unchanged.
Source, queues, branches, PRs, release artifacts and history are preserved.

## How to resume
Restore original triggers from this hold commit's parent or selectively revert this commit after inspecting usage/billing and any API secrets.
Manual dispatch still exists; please do not start workflows while the project is paused.

## Workflows paused
- `.github/workflows/android-build.yml`
- `.github/workflows/android-emulator-smoke.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/continuous-development.yml`
- `.github/workflows/development-queue.yml`
- `.github/workflows/android-signed-candidate.yml` was already manual-only.

Existing runs may have finished after the hold was requested; unrelated repositories are not changed.
