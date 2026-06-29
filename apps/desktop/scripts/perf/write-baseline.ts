// write-baseline.ts — writes perf/desktop-budgets.json from current bundle metrics
import {
  computeBundleMetrics,
  writeCurrentMetrics,
  writeCompareJson,
  loadBaseline,
  BASELINE_PATH,
  ensureDir,
  formatBytes,
} from './common';
import fs from 'fs';
import path from 'path';

const metrics = computeBundleMetrics();
writeCurrentMetrics(metrics);

const baseline = loadBaseline();
writeCompareJson(baseline, metrics);

// Write the baseline file (perf/desktop-budgets.json under repo root)
// Ensure the directory exists first
const baselineDir = path.dirname(BASELINE_PATH);
ensureDir(baselineDir);

fs.writeFileSync(BASELINE_PATH, JSON.stringify({
  totalJsGzipSize: metrics.totalJsGzipSize,
  largestChunkGzipSize: metrics.largestChunkGzipSize,
  sourcemapEmitted: metrics.sourcemapEmitted,
  chunkCount: metrics.chunkCount,
  initialRouteChunks: metrics.initialRouteChunks,
  auxiliaryChunks: metrics.auxiliaryChunks,
  dialogChunks: metrics.dialogChunks,
  generatedAt: new Date().toISOString(),
}, null, 2));

console.log('[perf] Baseline written to perf/desktop-budgets.json');
console.log(`  totalJsGzipSize:     ${formatBytes(metrics.totalJsGzipSize)}`);
console.log(`  largestChunkGzipSize: ${formatBytes(metrics.largestChunkGzipSize)}`);
console.log(`  sourcemapEmitted:    ${metrics.sourcemapEmitted}`);
console.log(`  chunkCount:          ${metrics.chunkCount}`);
console.log(`  visualizerJsonExists: ${metrics.visualizerJsonExists}`);
console.log(`  devtoolsInProd:      ${metrics.devtoolsInProd}`);
console.log(`  initialRouteChunks:  ${metrics.initialRouteChunks.length}`);
console.log(`  auxiliaryChunks:     ${metrics.auxiliaryChunks.length}`);
console.log(`  dialogChunks:        ${metrics.dialogChunks.length}`);
console.log(`  settingsChunks:      ${metrics.settingsChunks.length}`);
console.log(`  statisticsChunks:    ${metrics.statisticsChunks.length}`);
console.log(`  addTorrentChunks:     ${metrics.addTorrentChunks.length}`);