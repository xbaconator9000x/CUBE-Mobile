import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {reconcile} from '../scripts/development-queue.mjs';
import {
  chooseTask, taskPrompt, verifyReadme, verifyStagedPaths, recordPartialCheckpoint, validateCIRef,
} from '../scripts/continuous-agent.mjs';
const queue = JSON.parse(readFileSync(new URL('../queue/development.json', import.meta.url), 'utf8'));

test('selects the highest priority dependency-eligible task, never blocked tasks', () => {
  const selected = chooseTask(queue);
  assert.equal(selected?.id || null, reconcile(queue).parallelBatch[0] || null);
  assert.notEqual(selected?.id, 'Q003');
});
test('returns null when all tasks are done or blocked', () => {
  const q = structuredClone(queue);
  for (const task of q.tasks) if (task.status === 'pending') task.status = 'blocked';
  assert.equal(chooseTask(q), null);
});
test('agent prompt preserves fail-closed constraints and task identity', () => {
  const prompt = taskPrompt({id:'Q999',title:'Test task',validation:'Read-only checks',paths:['src/app.js']});
  assert.match(prompt, /Q999/);
  assert.match(prompt, /Never commit ROM\/save assets/);
  assert.match(prompt, /mark the task done ONLY/);
});
test('README test notice is immutable', () => {
  assert.doesNotThrow(() => verifyReadme('# Test\n\nThis is a test.\nMore'));
  assert.throws(() => verifyReadme('# Project\n\nThis is a test.\n'), /README/);
});
test('rejects copyrighted ROMs, secrets, and worker self-modification', () => {
  assert.doesNotThrow(() => verifyStagedPaths(['src/app.js', 'tests/app.test.mjs']));
  for (const file of ['game.gba', '.env', 'secrets/pin.key', 'android/keystore.p12', '.github/workflows/continuous-development.yml', 'scripts/continuous-agent.mjs', 'package.json'])
    assert.throws(() => verifyStagedPaths([file]), /Unsafe/);
  assert.throws(() => verifyStagedPaths(['.github/workflows/ci.yml']), /Unsafe/);
  assert.doesNotThrow(() => verifyStagedPaths(['.github/workflows/android-build.yml'], {paths:['.github/workflows/android-build.yml']}));
  assert.throws(() => verifyStagedPaths(['.github/workflows/android-build.yml'], {paths:['src/app.js']}), /Unsafe/);
  assert.throws(() => verifyStagedPaths([]), /No changes/);
});
test('checkpoint remains partial until independently accepted', () => {
  const q = {tasks:[{id:'Q999',status:'pending',checkpoint:null}]};
  const result = recordPartialCheckpoint(q, 'Q999', 'autocode/Q999-123', 'a'.repeat(40));
  const task = result.tasks[0];
  assert.equal(task.status, 'pending');
  assert.equal(task.checkpoint.kind, 'partial');
  assert.equal(task.checkpoint.baseCommit, 'a'.repeat(40));
  assert.throws(() => recordPartialCheckpoint(q, 'Q999', 'bad-branch', 'a'.repeat(40)), /Invalid/);
});
test('stale in-progress work returns to pending after a new checkpoint', () => {
  const q = {tasks:[{id:'Q999',status:'in_progress',owner:'runner',branch:'old',checkpoint:null}]};
  const t = q.tasks[0];
  t.status = 'in_progress'; t.owner = 'runner'; t.branch = 'old';
  recordPartialCheckpoint(q, 'Q999', 'autocode/Q999-123', 'a'.repeat(40));
  assert.equal(t.status, 'pending');
  assert.equal(t.owner, null);
  assert.equal(t.branch, null);
});

test('CI accepts only exact main or task branch SHA', () => {
  assert.doesNotThrow(() => validateCIRef('main', 'a'.repeat(40)));
  assert.doesNotThrow(() => validateCIRef('autocode/Q016-123', 'a'.repeat(40)));
  assert.throws(() => validateCIRef('untrusted-pr', 'a'.repeat(40)), /Invalid/);
  assert.throws(() => validateCIRef('main', 'not-a-sha'), /Invalid/);
});

test('selector CLI imports queue module without treating subcommand as a file path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cube-agent-test-'));
  try {
    const output = join(dir, 'output');
    const run = spawnSync(process.execPath, ['scripts/continuous-agent.mjs', 'select'], {
      cwd: new URL('..', import.meta.url).pathname,
      env: {...process.env, GITHUB_OUTPUT: output, RUNNER_TEMP: dir}, encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(readFileSync(output, 'utf8'), /has_task=(?:true|false)/);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});
