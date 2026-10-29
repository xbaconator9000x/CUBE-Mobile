# Continuous CUBE coding worker (opt-in)

The queue selector alone cannot write code. `.github/workflows/continuous-development.yml` connects an actual Codex CLI coding process to the authoritative `main:queue/development.json` task queue. It is **disabled by default** until a repository administrator configures it. The hourly ChatGPT watchdog remains a recovery path, not the primary chaining mechanism.

## Activation (repository administrator)

1. Configure repository Actions variable `CUBE_AUTOCODE_ENABLED=true` and Actions secret `OPENAI_API_KEY` using a project-scoped API key with an appropriate spending limit. This uses the OpenAI API, which may incur charges independently of ChatGPT subscriptions. Do not commit, paste or log the key. Review the workflow and token permissions before enabling.
2. Allow GitHub Actions to create pull requests, and set branch protection/required reviewers for `main` as appropriate. The worker does not bypass branch protection. If approval is required, it leaves a green PR awaiting approval rather than forcing a merge.
3. Manually dispatch **Continuous CUBE coding worker** on `main` once. Subsequent successful merges explicitly dispatch `Verify mobile source` on `main`, whose successful completion triggers the next worker run. This avoids waiting for the hourly watchdog. Main pushes also trigger the worker after source CI passes.
4. Disable immediately by changing `CUBE_AUTOCODE_ENABLED` to `false` or disabling the workflow. Do not run on untrusted PR code; only checked-out `main` is an input to the privileged worker.

## Safety and actual capabilities

The worker selects the first dependency-eligible, path-safe task from the existing queue; creates an isolated `autocode/QNNN-RUNID` branch; runs Codex in workspace-write mode for at most 30 minutes; checks the standalone build, unit tests, safety, parity and WBS; records a **partial** checkpoint rather than inventing feature acceptance; and opens a PR. Since pushes made with `GITHUB_TOKEN` do not automatically trigger normal push/PR workflows, the worker explicitly dispatches both source and Android workflows on the exact branch SHA, independently waits for success, and merges only after both succeed and any required reviews are satisfied. It then dispatches main source CI, which triggers the next batch.

Concurrency is serialized and existing open task PRs are not duplicated. A failed coding run, failed CI, required review, missing API key, no meaningful changes or blocked task stops the chain rather than fabricating success. The next watchdog or a new manual dispatch can recover. No copyrighted ROM, signing key, private data, or unauthenticated semantic ROM write authority is permitted. Independent CUBE ROM/TOML provenance, emulator gameplay and physical-device evidence remain separate acceptance requirements.

**Known limits:** The GitHub Actions workflow and CLI are prepared but are not proof that a Codex job has executed. Actual continuous operation requires repository secrets, Actions permissions, API billing and successful end-to-end smoke verification. A successful agent run is not equivalent to feature parity. No external ROM assets are provisioned by this workflow.
