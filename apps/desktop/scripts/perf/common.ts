// Shared utilities for desktop perf scripts
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { gzipSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, '../../../..');
export const DIST_DIR = path.join(REPO_ROOT, 'apps/desktop/dist/assets');
export const PERF_DIR = path.join(REPO_ROOT, 'artifacts/desktop/perf');
export const BASELINE_PATH = path.join(REPO_ROOT, 'perf/desktop-budgets.json');

export interface ChunkMeta {
  file: string;
  gzipSize: number;
  rawSize: number;
}

export interface BundleMetrics {
  totalJsGzipSize: number; // bytes
  largestChunkGzipSize: number; // bytes
  sourcemapEmitted: boolean;
  chunkCount: number;
  visualizerJsonExists: boolean;
  chunks: ChunkMeta[];
  // Guardrail flags
  devtoolsInProd: boolean;
  // Initial route chunks (home/login/add-server — non-auxiliary)
  initialRouteChunks: ChunkMeta[];
  // Auxiliary window chunks
  auxiliaryChunks: ChunkMeta[];
  // Dialog/screen chunks
  dialogChunks: ChunkMeta[];
  // Settings/statistics/add-torrent specific
  settingsChunks: ChunkMeta[];
  statisticsChunks: ChunkMeta[];
  addTorrentChunks: ChunkMeta[];
}

export interface BaselineBudget {
  totalJsGzipSize?: number;
  largestChunkGzipSize?: number;
  sourcemapEmitted?: boolean;
  chunkCount?: number;
  initialRouteChunks?: ChunkMeta[];
  auxiliaryChunks?: ChunkMeta[];
  dialogChunks?: ChunkMeta[];
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export interface VisualizerChunk {
  fileName: string;
  gzipSize: number | null;
  size: number;
}

// Normalized flat list — what we normalize tree shapes into
export interface NormalizedVizChunk {
  fileName: string;
  gzipSize: number;
  size: number;
}

export interface VisualizerData {
  // Accept both flat chunks array (raw-data plugin output) and
  // tree shape (rollup-plugin-visualizer v5 raw-data output):
  // { version: number, tree: { name: string, children: NormalizedVizChunk[] } }
  chunks?: VisualizerChunk[];
  tree?: {
    name: string;
    children?: NormalizedVizChunk[];
  };
  version?: number;
}

// Recursively flatten rollup-plugin-visualizer tree nodes into a flat chunk list
interface VizTreeNode {
  name: string;
  children?: VizTreeNode[] | NormalizedVizChunk[];
  gzipSize?: number | null;
  size?: number;
}

function flattenVizTree(node: VizTreeNode): NormalizedVizChunk[] {
  const result: NormalizedVizChunk[] = node.name.endsWith('.js')
    ? [{ fileName: node.name, gzipSize: node.gzipSize ?? 0, size: node.size ?? 0 }]
    : [];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenVizTree(child as VizTreeNode));
    }
  }
  return result;
}

function loadVisualizerStats(): { chunks: NormalizedVizChunk[] } | null {
  const statsJsonPath = path.join(REPO_ROOT, 'artifacts/desktop/bundle/stats.json');
  if (!fs.existsSync(statsJsonPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(statsJsonPath, 'utf-8')) as VisualizerData;
    // Flat chunks array form (raw-data plugin output)
    if (Array.isArray(raw.chunks)) {
      return {
        chunks: raw.chunks.filter(c => typeof c.fileName === 'string').map(c => ({
          fileName: c.fileName,
          gzipSize: c.gzipSize ?? 0,
          size: c.size,
        })),
      };
    }
    // Tree form (rollup-plugin-visualizer v5)
    if (raw.tree && Array.isArray(raw.tree.children)) {
      return { chunks: flattenVizTree(raw.tree as { name: string; children?: NormalizedVizChunk[] }) };
    }
    // Unrecognized shape — tolerate silently
    return null;
  } catch {
    return null;
  }
}

export function computeBundleMetrics(): BundleMetrics {
  // Compute gzip sizes from dist/assets JS files
  let totalJsGzipSize = 0;
  let largestChunkGzipSize = 0;
  let chunkCount = 0;
  let hasSourcemap = false;
  const chunks: ChunkMeta[] = [];

  try {
    const entries = fs.readdirSync(DIST_DIR);
    for (const entry of entries) {
      if (!entry.endsWith('.js')) continue;
      const filePath = path.join(DIST_DIR, entry);
      const content = fs.readFileSync(filePath);
      const gzipSize = gzipSync(content).length;
      const rawSize = content.length;
      totalJsGzipSize += gzipSize;
      largestChunkGzipSize = Math.max(largestChunkGzipSize, gzipSize);
      chunkCount++;
      chunks.push({ file: entry, gzipSize, rawSize });

      // Check for sourcemap adjacent file
      const mapPath = `${filePath}.map`;
      if (fs.existsSync(mapPath)) {
        hasSourcemap = true;
      }
    }
  } catch {
    // Dist may not exist yet
  }

  // Load visualizer stats for chunk-level categorization (tolerate missing)
  const vdata = loadVisualizerStats();
  const visualizerJsonExists = vdata !== null;

  // Categorize chunks by name heuristics
  // Visualizer fileName may include "assets/" prefix
  const isAuxiliary = (f: string) =>
    /settings|statistics|add[-_]?torrent/i.test(f) &&
    !/add[-_]?server/i.test(f);

  const isDialog = (f: string) =>
    /dialog|rename|confirm|create|edit[-_]?category|torrent[-_]?(text|numeric|delete|share|transfer)|category[-_]?select|tag[-_]?select|entity[-_]?confirm/i.test(f);

  const isInitialRoute = (f: string) =>
    /^(main|home|login|add[-_]?server)/i.test(f);

  const isSettings = (f: string) => /settings/i.test(f);
  const isStatistics = (f: string) => /statistics/i.test(f);
  const isAddTorrent = (f: string) => /add[-_]?torrent/i.test(f) && !/add[-_]?server/i.test(f);

  // Helper: pick gzip from visualizer if available, else compute from file
  function chunkGzip(file: string, fallbackGzip: number): number {
    if (!vdata) return fallbackGzip;
    // visualizer fileName may be "assets/main-[hash].js"
    const found = vdata.chunks.find(
      c => c.fileName.includes(file.replace(/"/g, '')) || file.includes(c.fileName.replace(/"/g, ''))
    );
    return found?.gzipSize || fallbackGzip;
  }

  const initialRouteChunks: ChunkMeta[] = [];
  const auxiliaryChunks: ChunkMeta[] = [];
  const dialogChunks: ChunkMeta[] = [];
  const settingsChunks: ChunkMeta[] = [];
  const statisticsChunks: ChunkMeta[] = [];
  const addTorrentChunks: ChunkMeta[] = [];

  for (const c of chunks) {
    const gs = chunkGzip(c.file, c.gzipSize);
    if (isInitialRoute(c.file)) {
      initialRouteChunks.push({ ...c, gzipSize: gs });
    }
    if (isAuxiliary(c.file)) auxiliaryChunks.push({ ...c, gzipSize: gs });
    if (isDialog(c.file)) dialogChunks.push({ ...c, gzipSize: gs });
    if (isSettings(c.file)) settingsChunks.push({ ...c, gzipSize: gs });
    if (isStatistics(c.file)) statisticsChunks.push({ ...c, gzipSize: gs });
    if (isAddTorrent(c.file)) addTorrentChunks.push({ ...c, gzipSize: gs });
  }

  // Check for devtools in prod bundle
  let devtoolsInProd = false;
  try {
    const entry = fs.readdirSync(DIST_DIR);
    for (const e of entry) {
      if (!e.endsWith('.js')) continue;
      const content = fs.readFileSync(path.join(DIST_DIR, e), 'utf-8');
      if (content.includes('@tanstack/react-query-devtools') || content.includes('ReactQueryDevtools')) {
        devtoolsInProd = true;
        break;
      }
    }
  } catch {
    // ignore
  }

  return {
    totalJsGzipSize,
    largestChunkGzipSize,
    sourcemapEmitted: hasSourcemap,
    chunkCount,
    visualizerJsonExists,
    chunks,
    devtoolsInProd,
    initialRouteChunks,
    auxiliaryChunks,
    dialogChunks,
    settingsChunks,
    statisticsChunks,
    addTorrentChunks,
  };
}

export function loadBaseline(): BaselineBudget | null {
  if (!fs.existsSync(BASELINE_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as BaselineBudget;
  } catch {
    return null;
  }
}

export function writeCurrentMetrics(metrics: BundleMetrics): void {
  ensureDir(PERF_DIR);
  const currentPath = path.join(PERF_DIR, 'current.json');
  fs.writeFileSync(currentPath, JSON.stringify(metrics, null, 2));
}

export function writeCompareJson(baseline: BaselineBudget | null, metrics: BundleMetrics): void {
  ensureDir(PERF_DIR);
  const comparePath = path.join(PERF_DIR, 'compare.json');

  const regressions: Array<{ metric: string; baseline: number | boolean; current: number | boolean }> = [];

  if (baseline) {
    if (metrics.totalJsGzipSize > (baseline.totalJsGzipSize ?? Infinity)) {
      regressions.push({
        metric: 'totalJsGzipSize',
        baseline: baseline.totalJsGzipSize ?? 0,
        current: metrics.totalJsGzipSize,
      });
    }
    if (metrics.largestChunkGzipSize > (baseline.largestChunkGzipSize ?? Infinity)) {
      regressions.push({
        metric: 'largestChunkGzipSize',
        baseline: baseline.largestChunkGzipSize ?? 0,
        current: metrics.largestChunkGzipSize,
      });
    }
    if (metrics.chunkCount > (baseline.chunkCount ?? Infinity)) {
      regressions.push({
        metric: 'chunkCount',
        baseline: baseline.chunkCount ?? 0,
        current: metrics.chunkCount,
      });
    }
    if (metrics.sourcemapEmitted !== baseline.sourcemapEmitted) {
      regressions.push({
        metric: 'sourcemapEmitted',
        baseline: baseline.sourcemapEmitted ?? false,
        current: metrics.sourcemapEmitted,
      });
    }
  }

  const result = {
    baseline,
    current: metrics,
    regressions,
    hasBaseline: baseline !== null,
  };

  fs.writeFileSync(comparePath, JSON.stringify(result, null, 2));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
