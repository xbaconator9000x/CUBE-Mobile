import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {reconcile} from './development-queue.mjs';

const taskIdPattern = /^Q\d{3}$/;
const prohibited = /(^|\/)(?:\.env(?:\..*)?|[^/]+\.(?:gba|gbc|sav|srm|p12|keystore|pem|key))$/i;
const runnerFiles = new Set([
  '.github/workflows/continuous-development.yml',
  'scripts/continuous-agent.mjs',
  'tests/continuous-agent.test.mjs',
  'scripts/development-queue.mjs',
  'scripts/repository-safety.mjs',
  'scripts/parity-audit.mjs',
  'scripts/engineering-audit.mjs',
]);
const protectedWorkflows = new Set([
  '.github/workflows/ci.yml',
  '.github/workflows/android-build.yml',
  '.github/workflows/android-emulator-smoke.yml',
  '.github/workflows/development-queue.yml',
]);

export function chooseTask(queue) {
  const selected = reconcile(queue).parallelBatch;
  const id = selected[0];
  if (!id) return null;
  if (!taskIdPattern.test(id)) throw new Error('Unsafe task ID');
  const task = queue.tasks.find(item => item.id === id);
  if (!task || task.status !== 'pending' || task.blocker) throw new Error('Selected task is not runnable');
  return task;
}

export function taskPrompt(task) {
  if (!taskIdPattern.test(task.id)) throw new Error('Unsafe task ID');
  return `You are the implementation engineer for the intentionally public CUBE-Mobile project.
Implement exactly this dependency-eligible queue task on the checked-out work branch:
ID: ${task.id}
Title: ${task.title}
Required validation: ${task.validation}
Primary paths: ${task.paths.join(', ')}

Read the current main-derived repository and pinned upstream provenance before editing. Make a substantial, source-grounded working implementation, with regression tests and documentation where needed. Reuse licensed upstream code only with attribution. Do not substitute synthetic tests for genuine ROM, emulator or Android acceptance. Never commit ROM/save assets, credentials or private information. Preserve the README opening exactly as two lines '# Test' and 'This is a test.' with the blank line between them. Fail closed on unverified ROM writes and never enable unsafe semantic write authority. Do not modify the continuous worker workflow or its runner/test files.

Update queue/development.json with truthful evidence and a partial checkpoint if work is incomplete; mark the task done ONLY if all of its stated acceptance requirements are actually met. If blocked by external ROM/device evidence, record the blocker and move to other independent work only if it remains within this task's scope. Do not fabricate acceptance. You may edit tests, docs and related source beyond the primary paths when necessary. Finish with a concise summary of implementation and tests. Do not create a PR or push; the workflow handles that after verification.`;
}

export function verifyReadme(text) {
  if (!text.replaceAll('\r\n', '\n').startsWith('# Test\n\nThis is a test.\n'))
    throw new Error('README opening changed');
}

export function verifyStagedPaths(paths, task = null) {
  if (!paths.length) throw new Error('No changes staged');
  for (const path of paths) {
    if (!path || path.includes('..') || prohibited.test(path) || runnerFiles.has(path) ||
        (protectedWorkflows.has(path) && !task?.paths?.includes(path)))
      throw new Error('Unsafe or runner-controlled staged path: ' + path);
  }
}

export function recordPartialCheckpoint(queue, taskId, branch, sha) {
  if (!taskIdPattern.test(taskId) || !/^autocode\/Q\d{3}-\d+$/.test(branch) || !/^[a-f0-9]{40}$/.test(sha))
    throw new Error('Invalid task checkpoint identifiers');
  const task = queue.tasks.find(t => t.id === taskId);
  if (!task || !['pending', 'in_progress', 'blocked', 'done'].includes(task.status))
    throw new Error('Unexpected task status');
  if (task.status === 'in_progress') {
    task.status = 'pending';
    task.owner = null;
    task.branch = null;
  }
  if (task.status === 'pending') {
    task.checkpoint = {
      ...task.checkpoint,
      date: new Date().toISOString().slice(0, 10),
      kind: 'partial',
      branch,
      baseCommit: sha,
      summary: task.checkpoint?.summary || 'Automated implementation candidate; final acceptance and CI are not inferred.',
    };
  }
  return queue;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function github(path, options = {}) {
  const token = process.env.GH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || ''))
    throw new Error('GitHub Actions token/repository unavailable');
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? {'Content-Type': 'application/json'} : {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.status === 204 ? null : response.json();
}

export function validateCIRef(branch, sha) {
  if (!(branch === 'main' || /^autocode\/Q\d{3}-\d+$/.test(branch)) || !/^[a-f0-9]{40}$/.test(sha))
    throw new Error('Invalid branch or commit for CI');
}

export async function verifyDispatchedChecks(branch, sha, workflows = ['ci.yml', 'android-build.yml']) {
  validateCIRef(branch, sha);
  const started = Date.now() - 8000;
  await Promise.all(workflows.map(workflow => github(`actions/workflows/${workflow}/dispatches`, {
    method: 'POST', body: JSON.stringify({ref: branch}),
  })));
  const deadline = Date.now() + 25 * 60_000;
  const pending = new Set(workflows);
  while (pending.size && Date.now() < deadline) {
    for (const workflow of [...pending]) {
      const data = await github(`actions/workflows/${workflow}/runs?branch=${encodeURIComponent(branch)}&event=workflow_dispatch&per_page=30`);
      const run = (data.workflow_runs || []).find(r => r.head_sha === sha && Date.parse(r.created_at) >= started);
      if (!run || run.status !== 'completed') continue;
      if (run.conclusion !== 'success') throw new Error(`${workflow} failed: ${run.html_url || run.id}`);
      console.log(`${workflow} passed: ${run.html_url || run.id}`);
      pending.delete(workflow);
    }
    if (pending.size) await sleep(12000);
  }
  if (pending.size) throw new Error('CI timeout: ' + [...pending].join(', '));
}

async function main() {
  const command = process.argv[2];
  if (command === 'select') {
    const queue = JSON.parse(readFileSync('queue/development.json', 'utf8'));
    const task = chooseTask(queue);
    const output = process.env.GITHUB_OUTPUT;
    if (!output) throw new Error('GITHUB_OUTPUT missing');
    if (!task) { writeFileSync(output, 'has_task=false\n', {flag: 'a'}); return; }
    writeFileSync(process.env.RUNNER_TEMP + '/cube-agent-task.txt', taskPrompt(task));
    writeFileSync(output, `has_task=true\ntask_id=${task.id}\n`, {flag: 'a'});
    console.log('Selected ' + task.id + ': ' + task.title);
  } else if (command === 'verify') {
    verifyReadme(readFileSync('README.md', 'utf8'));
    const paths = execFileSync('git', ['diff', '--cached', '--name-only', '-z']).toString().split('\0').filter(Boolean);
    const queue = JSON.parse(readFileSync('queue/development.json', 'utf8'));
    reconcile(queue);
    const task = queue.tasks.find(t => t.id === process.env.TASK_ID);
    if (!task) throw new Error('Active task not found in queue');
    verifyStagedPaths(paths, task);
  } else if (command === 'checkpoint') {
    const [taskId, branch, sha] = process.argv.slice(3);
    const queue = JSON.parse(readFileSync('queue/development.json', 'utf8'));
    recordPartialCheckpoint(queue, taskId, branch, sha);
    writeFileSync('queue/development.json', JSON.stringify(queue, null, 2) + '\n');
  } else if (command === 'ci') {
    await verifyDispatchedChecks(process.argv[3], process.argv[4], process.argv.length > 5 ? process.argv.slice(5) : undefined);
  } else throw new Error('Usage: continuous-agent.mjs select|verify|checkpoint|ci');
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href)
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
