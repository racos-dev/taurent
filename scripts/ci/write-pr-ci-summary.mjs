import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function statusEmoji(status) {
  switch (status) {
    case 'success':
      return '✅';
    case 'failure':
      return '❌';
    case 'skipped':
      return '⏭️';
    case 'cancelled':
      return '🚫';
    default:
      return '❔';
  }
}

export function escapeMarkdown(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[');
}

const JS_STEP_NAMES = {
  'check-versions': 'Check app versions',
  lint: 'Lint',
  typecheck: 'Typecheck',
  'unit-tests': 'Unit tests',
  'renderer-e2e': 'Renderer e2e',
};

const RUST_STEP_NAMES = {
  'rustfmt-check': 'Rustfmt check',
  'cargo-check-core': 'Cargo check (core)',
  'cargo-check-tauri': 'Cargo check (tauri)',
  'clippy-core': 'Clippy (core)',
  'clippy-tauri': 'Clippy (tauri)',
};

function parseStepOutcomes() {
  const raw = process.env.CI_STEP_OUTCOMES ?? '{}';
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error(`write-pr-ci-summary: invalid CI_STEP_OUTCOMES JSON: ${err.message}`);
    return {};
  }
}

export function buildStepRows(stepNames, outcomes) {
  return Object.entries(stepNames).map(([id, displayName]) => {
    const outcome = outcomes[id] ?? 'skipped';
    return `| ${escapeMarkdown(displayName)} | ${statusEmoji(outcome)} ${outcome} |`;
  });
}

export function writeJsQualitySummary() {
  const jobResult = process.env.CI_JOB_RESULT ?? 'unknown';
  const outcomes = parseStepOutcomes();
  const rows = buildStepRows(JS_STEP_NAMES, outcomes);

  return [
    '## JS Quality Summary',
    '',
    '| Step | Outcome |',
    '|------|---------|',
    ...rows,
    '',
    `**Job result: ${statusEmoji(jobResult)} ${jobResult}**`,
    '',
  ].join('\n');
}

export function writeRustQualitySummary() {
  const jobResult = process.env.CI_JOB_RESULT ?? 'unknown';
  const outcomes = parseStepOutcomes();
  const rows = buildStepRows(RUST_STEP_NAMES, outcomes);

  return [
    '## Rust Quality Summary',
    '',
    '| Step | Outcome |',
    '|------|---------|',
    ...rows,
    '',
    `**Job result: ${statusEmoji(jobResult)} ${jobResult}**`,
    '',
  ].join('\n');
}

function main() {
  const kind = process.env.CI_JOB_KIND;
  const output = process.env.GITHUB_STEP_SUMMARY;

  try {
    let md = '';
    switch (kind) {
      case 'js-quality':
        md = writeJsQualitySummary();
        break;
      case 'rust-quality':
        md = writeRustQualitySummary();
        break;
      default:
        throw new Error(`Unknown CI_JOB_KIND: ${kind}`);
    }
    if (output) {
      appendFileSync(output, `${md}\n`);
    } else {
      process.stdout.write(`${md}\n`);
    }
  } catch (err) {
    console.error(`write-pr-ci-summary: ${err.message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
const isMain = invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
