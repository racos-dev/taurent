// check-bundle.ts — hard guardrail checks for desktop production bundle
// Exits non-zero only for hard guardrails: devtools in prod, sourcemaps when VITE_SOURCEMAP not set.
// Size regressions warn until a baseline is established.
import {
  computeBundleMetrics,
  writeCurrentMetrics,
  writeCompareJson,
  loadBaseline,
  formatBytes,
  PERF_DIR,
  ensureDir,
} from './common';
import fs from 'fs';
import path from 'path';

const BUNDLE_CHECK_PATH = path.join(PERF_DIR, 'bundle-check.json');

const metrics = computeBundleMetrics();
writeCurrentMetrics(metrics);

const baseline = loadBaseline();
writeCompareJson(baseline, metrics);

const checks: Array<{ id: string; pass: boolean; message: string; isHard: boolean }> = [];

// ── Hard guardrail: devtools must not be in production bundle ───────────────
checks.push({
  id: 'devtools-in-prod',
  pass: !metrics.devtoolsInProd,
  message: metrics.devtoolsInProd
    ? 'ERROR: @tanstack/react-query-devtools found in production bundle'
    : 'OK: @tanstack/react-query-devtools not in production bundle',
  isHard: true,
});

// ── Hard guardrail: sourcemaps must not be emitted unless VITE_SOURCEMAP=1 ──
const sourcemapEnv = process.env.VITE_SOURCEMAP;
if (sourcemapEnv !== '1') {
  checks.push({
    id: 'sourcemap-not-in-prod',
    pass: !metrics.sourcemapEmitted,
    message: metrics.sourcemapEmitted
      ? 'ERROR: sourcemaps were emitted but VITE_SOURCEMAP is not set to 1'
      : 'OK: sourcemaps not emitted (VITE_SOURCEMAP not set)',
    isHard: true,
  });
} else {
  checks.push({
    id: 'sourcemap-expected',
    pass: metrics.sourcemapEmitted,
    message: metrics.sourcemapEmitted
      ? 'OK: sourcemaps emitted (VITE_SOURCEMAP=1)'
      : 'WARNING: VITE_SOURCEMAP=1 but no sourcemaps found in output',
    isHard: false,
  });
}

// ── Size regression checks (warn-only until baseline established) ───────────
if (baseline) {
  if (metrics.totalJsGzipSize > (baseline.totalJsGzipSize ?? Infinity)) {
    const delta = metrics.totalJsGzipSize - (baseline.totalJsGzipSize ?? 0);
    const pct = (((metrics.totalJsGzipSize - baseline.totalJsGzipSize!) / baseline.totalJsGzipSize!) * 100).toFixed(1);
    checks.push({
      id: 'total-js-size',
      pass: false,
      message: `WARNING: totalJsGzipSize regressed ${formatBytes(baseline.totalJsGzipSize!)} → ${formatBytes(metrics.totalJsGzipSize)} (+${pct}%, +${formatBytes(delta)})`,
      isHard: false,
    });
  }
  if (metrics.largestChunkGzipSize > (baseline.largestChunkGzipSize ?? Infinity)) {
    const delta = metrics.largestChunkGzipSize - (baseline.largestChunkGzipSize ?? 0);
    const pct = (((metrics.largestChunkGzipSize - baseline.largestChunkGzipSize!) / baseline.largestChunkGzipSize!) * 100).toFixed(1);
    checks.push({
      id: 'largest-chunk-size',
      pass: false,
      message: `WARNING: largestChunkGzipSize regressed ${formatBytes(baseline.largestChunkGzipSize!)} → ${formatBytes(metrics.largestChunkGzipSize)} (+${pct}%, +${formatBytes(delta)})`,
      isHard: false,
    });
  }
  if (metrics.chunkCount > (baseline.chunkCount ?? Infinity)) {
    const delta = metrics.chunkCount - (baseline.chunkCount ?? 0);
    checks.push({
      id: 'chunk-count',
      pass: false,
      message: `WARNING: chunkCount regressed ${baseline.chunkCount} → ${metrics.chunkCount} (+${delta})`,
      isHard: false,
    });
  }
  // Check auxiliary / dialog chunk counts
  if (metrics.auxiliaryChunks.length > (baseline.auxiliaryChunks?.length ?? Infinity)) {
    checks.push({
      id: 'auxiliary-chunk-count',
      pass: false,
      message: `WARNING: auxiliaryChunks regressed ${baseline.auxiliaryChunks?.length ?? 0} → ${metrics.auxiliaryChunks.length}`,
      isHard: false,
    });
  }
  if (metrics.dialogChunks.length > (baseline.dialogChunks?.length ?? Infinity)) {
    checks.push({
      id: 'dialog-chunk-count',
      pass: false,
      message: `WARNING: dialogChunks regressed ${baseline.dialogChunks?.length ?? 0} → ${metrics.dialogChunks.length}`,
      isHard: false,
    });
  }
} else {
  checks.push({
    id: 'no-baseline',
    pass: true,
    message: 'INFO: No baseline found — size regression checks skipped. Run "pnpm desktop:perf:baseline" to establish a baseline.',
    isHard: false,
  });
}

// ── Write bundle-check.json ───────────────────────────────────────────────────
ensureDir(PERF_DIR);
const hardFails = checks.filter(c => !c.pass && c.isHard);
const softWarns = checks.filter(c => !c.pass && !c.isHard);

fs.writeFileSync(BUNDLE_CHECK_PATH, JSON.stringify({
  timestamp: new Date().toISOString(),
  checks,
  hardFails: hardFails.length,
  softWarns: softWarns.length,
  passed: checks.every(c => c.pass),
}, null, 2));

// ── Console output ───────────────────────────────────────────────────────────
console.log('[bundle-check] Desktop bundle guardrail check');
console.log(`  sourcemapEmitted:     ${metrics.sourcemapEmitted}`);
console.log(`  devtoolsInProd:       ${metrics.devtoolsInProd}`);
console.log(`  totalJsGzipSize:      ${formatBytes(metrics.totalJsGzipSize)}`);
console.log(`  largestChunkGzipSize: ${formatBytes(metrics.largestChunkGzipSize)}`);
console.log(`  chunkCount:           ${metrics.chunkCount}`);
console.log(`  initialRouteChunks:   ${metrics.initialRouteChunks.length} (${formatBytes(metrics.initialRouteChunks.reduce((s, c) => s + c.gzipSize, 0))})`);
console.log(`  auxiliaryChunks:      ${metrics.auxiliaryChunks.length} (${formatBytes(metrics.auxiliaryChunks.reduce((s, c) => s + c.gzipSize, 0))})`);
console.log(`  dialogChunks:         ${metrics.dialogChunks.length} (${formatBytes(metrics.dialogChunks.reduce((s, c) => s + c.gzipSize, 0))})`);
console.log(`  settingsChunks:       ${metrics.settingsChunks.length} (${formatBytes(metrics.settingsChunks.reduce((s, c) => s + c.gzipSize, 0))})`);
console.log(`  statisticsChunks:    ${metrics.statisticsChunks.length} (${formatBytes(metrics.statisticsChunks.reduce((s, c) => s + c.gzipSize, 0))})`);
console.log(`  addTorrentChunks:     ${metrics.addTorrentChunks.length} (${formatBytes(metrics.addTorrentChunks.reduce((s, c) => s + c.gzipSize, 0))})`);
console.log('');

for (const c of checks) {
  const icon = c.pass ? '✓' : (c.isHard ? '✗' : '⚠');
  console.log(`[bundle-check] ${icon} ${c.id}: ${c.message}`);
}

console.log('');
console.log(`[bundle-check] Results written to artifacts/desktop/perf/bundle-check.json`);

// ── Exit logic: only fail on hard guardrail violations ──────────────────────
if (hardFails.length > 0) {
  console.error('');
  console.error('[bundle-check] HARD GUARDRAIL FAILURE — exiting with non-zero');
  process.exit(1);
}

console.log('[bundle-check] All hard guardrails passed.');
process.exit(0);
