import { spawnSync } from 'node:child_process';
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
