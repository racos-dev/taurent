// compare-baseline.ts — compares current bundle metrics against committed baseline
import {
  computeBundleMetrics,
  writeCurrentMetrics,
  writeCompareJson,
  loadBaseline,
  formatBytes,
} from './common';

const metrics = computeBundleMetrics();
writeCurrentMetrics(metrics);

const baseline = loadBaseline();
writeCompareJson(baseline, metrics);

if (!baseline) {
  console.warn('[perf] No baseline found at perf/desktop-budgets.json — skipping comparison');
  console.warn('[perf] Run "pnpm desktop:perf:baseline" to generate a baseline first');
  process.exit(0);
}

const regressions: string[] = [];

if (metrics.totalJsGzipSize > (baseline.totalJsGzipSize ?? Infinity)) {
  const pct = (((metrics.totalJsGzipSize - baseline.totalJsGzipSize!) / baseline.totalJsGzipSize!) * 100).toFixed(1);
  regressions.push(
    `totalJsGzipSize: ${formatBytes(baseline.totalJsGzipSize!)} → ${formatBytes(metrics.totalJsGzipSize)} (+${pct}%)`,
  );
}
if (metrics.largestChunkGzipSize > (baseline.largestChunkGzipSize ?? Infinity)) {
  const pct = (((metrics.largestChunkGzipSize - baseline.largestChunkGzipSize!) / baseline.largestChunkGzipSize!) * 100).toFixed(1);
  regressions.push(
    `largestChunkGzipSize: ${formatBytes(baseline.largestChunkGzipSize!)} → ${formatBytes(metrics.largestChunkGzipSize)} (+${pct}%)`,
  );
}
if (metrics.chunkCount > (baseline.chunkCount ?? Infinity)) {
  regressions.push(
    `chunkCount: ${baseline.chunkCount} → ${metrics.chunkCount}`,
  );
}
if (metrics.sourcemapEmitted !== baseline.sourcemapEmitted) {
  regressions.push(
    `sourcemapEmitted: ${baseline.sourcemapEmitted} → ${metrics.sourcemapEmitted}`,
  );
}

console.log('[perf] Bundle metrics:');
console.log(`  totalJsGzipSize:      ${formatBytes(metrics.totalJsGzipSize)}`);
console.log(`  largestChunkGzipSize: ${formatBytes(metrics.largestChunkGzipSize)}`);
console.log(`  sourcemapEmitted:     ${metrics.sourcemapEmitted}`);
console.log(`  chunkCount:           ${metrics.chunkCount}`);
console.log(`  visualizerJsonExists: ${metrics.visualizerJsonExists}`);
console.log('');
console.log('[perf] Baseline:');
console.log(`  totalJsGzipSize:      ${formatBytes(baseline.totalJsGzipSize ?? 0)}`);
console.log(`  largestChunkGzipSize: ${formatBytes(baseline.largestChunkGzipSize ?? 0)}`);
console.log(`  sourcemapEmitted:     ${baseline.sourcemapEmitted ?? 'N/A'}`);
console.log(`  chunkCount:           ${baseline.chunkCount ?? 'N/A'}`);

if (regressions.length > 0) {
  console.warn('');
  console.warn('[perf] ⚠ Regressions detected:');
  for (const r of regressions) {
    console.warn(`  - ${r}`);
  }
} else {
  console.log('[perf] ✓ No regressions detected');
}

process.exit(0);