import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeMarkdown } from './write-pr-ci-summary.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scriptPath = resolve(repoRoot, 'scripts/ci/write-pr-ci-summary.mjs');

function runSummary(env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: { ...process.env, ...env, GITHUB_STEP_SUMMARY: '' },
    encoding: 'utf8',
  });
}

test('JS quality summary shows all steps with success emojis', () => {
  const result = runSummary({
    CI_JOB_KIND: 'js-quality',
    CI_JOB_RESULT: 'success',
    CI_STEP_OUTCOMES: JSON.stringify({
      'check-versions': 'success',
      lint: 'success',
      typecheck: 'success',
      'unit-tests': 'success',
      'renderer-e2e': 'success',
    }),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## JS Quality Summary/);
  assert.match(result.stdout, /Check app versions\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Lint\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Typecheck\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Unit tests\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Renderer e2e\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /\*\*Job result: ✅ success\*\*/);
});

test('JS quality summary maps mixed step outcomes to correct emojis', () => {
  const result = runSummary({
    CI_JOB_KIND: 'js-quality',
    CI_JOB_RESULT: 'failure',
    CI_STEP_OUTCOMES: JSON.stringify({
      'check-versions': 'success',
      lint: 'failure',
      typecheck: 'success',
      'unit-tests': 'success',
      'renderer-e2e': 'success',
    }),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Check app versions\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Lint\s*\|\s*❌\sfailure\s*\|/);
  assert.match(result.stdout, /Typecheck\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Unit tests\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Renderer e2e\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /\*\*Job result: ❌ failure\*\*/);
});

test('Rust quality summary shows all steps with success emojis', () => {
  const result = runSummary({
    CI_JOB_KIND: 'rust-quality',
    CI_JOB_RESULT: 'success',
    CI_STEP_OUTCOMES: JSON.stringify({
      'rustfmt-check': 'success',
      'cargo-check-core': 'success',
      'cargo-check-tauri': 'success',
      'clippy-core': 'success',
      'clippy-tauri': 'success',
    }),
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## Rust Quality Summary/);
  assert.match(result.stdout, /Rustfmt check\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Cargo check \(core\)\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Cargo check \(tauri\)\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Clippy \(core\)\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /Clippy \(tauri\)\s*\|\s*✅\s*success\s*\|/);
  assert.match(result.stdout, /\*\*Job result: ✅ success\*\*/);
});

test('Aggregate summary shows all lanes passing with artifact link', () => {
  const result = runSummary({
    CI_JOB_KIND: 'aggregate',
    CI_JS_RESULT: 'success',
    CI_RUST_RESULT: 'success',
    CI_SMOKE_RESULT: 'success',
    GITHUB_RUN_ID: '12345',
    GITHUB_REPOSITORY: 'racos-dev/taurent',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## PR CI Overview/);
  assert.match(result.stdout, /JS Quality\s*\|\s*✅\ssuccess\s*\|/);
  assert.match(result.stdout, /Rust Quality\s*\|\s*✅\ssuccess\s*\|/);
  assert.match(result.stdout, /Desktop Tauri Smoke \(Linux\)\s*\|\s*✅\ssuccess\s*\|/);
  assert.match(
    result.stdout,
    /\[View artifacts\]\(https:\/\/github\.com\/racos-dev\/taurent\/actions\/runs\/12345\)/,
  );
});

test('Aggregate summary shows skipped smoke when prior lane failed', () => {
  const result = runSummary({
    CI_JOB_KIND: 'aggregate',
    CI_JS_RESULT: 'success',
    CI_RUST_RESULT: 'failure',
    CI_SMOKE_RESULT: 'skipped',
    GITHUB_RUN_ID: '999',
    GITHUB_REPOSITORY: 'racos-dev/taurent',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JS Quality\s*\|\s*✅\ssuccess\s*\|/);
  assert.match(result.stdout, /Rust Quality\s*\|\s*❌\sfailure\s*\|/);
  assert.match(result.stdout, /Desktop Tauri Smoke \(Linux\)\s*\|\s*⏭️\sskipped\s*\|/);
});

test('Native smoke summary reads perf artifact fields when JSON is valid', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'taurent-pr-ci-summary-perf-'));
  const perfPath = resolve(dir, 'native-smoke.json');
  writeFileSync(
    perfPath,
    JSON.stringify({
      runtime: 'native-tauri-smoke',
      scenario: 'small-100',
      success: true,
      durationMs: 12345,
      timings: {
        appLaunchMs: 1000,
        serverConnectMs: 500,
        tableVisibleMs: 2000,
        interactionPhaseMs: 8000,
      },
      backendChecks: ['a', 'b', 'c', 'd', 'e'],
      sync: { pass: true, blockers: [] },
    }),
  );

  const result = runSummary({
    CI_JOB_KIND: 'native-smoke',
    CI_JOB_RESULT: 'success',
    CI_PERF_ARTIFACT_PATH: perfPath,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## Desktop Tauri Smoke Summary/);
  assert.match(result.stdout, /Scenario\s*\|\s*small-100\s*\|/);
  assert.match(result.stdout, /Duration\s*\|\s*12\.3s\s*\|/);
  assert.match(result.stdout, /Sync Pass\s*\|\s*✅\s*\|/);
  assert.match(result.stdout, /Backend Checks\s*\|\s*5\s*\|/);
  assert.match(result.stdout, /Artifacts\s*\|\s*desktop-tauri-e2e-artifacts, desktop-tauri-perf\s*\|/);
  assert.match(result.stdout, /\*\*Job result: ✅ success\*\*/);
});

test('Native smoke summary handles missing perf artifact gracefully', () => {
  const result = runSummary({
    CI_JOB_KIND: 'native-smoke',
    CI_JOB_RESULT: 'failure',
    CI_PERF_ARTIFACT_PATH: '/does/not/exist/native-smoke.json',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Duration\s*\|\s*No perf data — artifact not produced\s*\|/);
  assert.match(result.stdout, /Sync Pass\s*\|\s*N\/A\s*\|/);
  assert.match(result.stdout, /Backend Checks\s*\|\s*N\/A\s*\|/);
});

test('Native smoke summary handles malformed perf JSON', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'taurent-pr-ci-summary-perf-bad-'));
  const perfPath = resolve(dir, 'native-smoke.json');
  writeFileSync(perfPath, '{this is definitely not valid JSON');

  const result = runSummary({
    CI_JOB_KIND: 'native-smoke',
    CI_JOB_RESULT: 'failure',
    CI_PERF_ARTIFACT_PATH: perfPath,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Duration\s*\|\s*Perf data unreadable\s*\|/);
  assert.match(result.stdout, /Sync Pass\s*\|\s*N\/A\s*\|/);
  assert.match(result.stdout, /Backend Checks\s*\|\s*N\/A\s*\|/);
});

test('escapeMarkdown escapes pipe, asterisk, backtick, and bracket', () => {
  assert.equal(escapeMarkdown('a|b'), 'a\\|b');
  assert.equal(escapeMarkdown('a*b'), 'a\\*b');
  assert.equal(escapeMarkdown('a`b'), 'a\\`b');
  assert.equal(escapeMarkdown('a[b'), 'a\\[b');
  assert.equal(escapeMarkdown('no special chars'), 'no special chars');
  assert.equal(escapeMarkdown(''), '');
  assert.equal(
    escapeMarkdown('mixed | * ` [ characters'),
    'mixed \\| \\* \\` \\[ characters',
  );
});