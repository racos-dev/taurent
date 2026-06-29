// perfAudit — opt-in browser-only measurement instrumentation.
//
// Opt-in: set window.localStorage['taurent:perf-audit'] = '1' before app loads
// or paste in console: localStorage['taurent:perf-audit'] = '1', then reload.
//
// Disable: clear the key or set it to '0', then reload.
//
// Output: summary stats (count, avg, p50, p95, max) per label via console.info.
// Logs are throttled — the aggregator flushes every ~30 s and only when samples exist.
// All functions are no-ops when the flag is absent or falsy.
//
// SSR / non-browser safety: all file-scope checks guard against missing window/localStorage.

const STORAGE_KEY = 'taurent:perf-audit' as const;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_SAMPLES_PER_LABEL = 10_000;
const MAX_COUNTER_KEYS_PER_LABEL = 20;
let _enabledCache: boolean | null = null;

// ─── Guards ──────────────────────────────────────────────────────────────────

export function isPerfAuditEnabled(): boolean {
  if (_enabledCache !== null) return _enabledCache;
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      _enabledCache = false;
      return _enabledCache;
    }
    _enabledCache = window.localStorage.getItem(STORAGE_KEY) === '1';
    return _enabledCache;
  } catch {
    _enabledCache = false;
    return _enabledCache;
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// ─── Sampler ──────────────────────────────────────────────────────────────────

interface SampleStore {
  label: string;
  values: number[];
  lastFlush: number;
}

const _stores = new Map<string, SampleStore>();

function _store(label: string): SampleStore {
  let s = _stores.get(label);
  if (!s) {
    s = { label, values: [], lastFlush: now() };
    _stores.set(label, s);
  }
  return s;
}

function _pct(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function _flush(label: string, s: SampleStore): void {
  if (s.values.length === 0) return;
  const count = s.values.length;
  const sum = s.values.reduce((a, b) => a + b, 0);
  const avg = sum / count;
  const p50 = _pct(s.values, 0.5);
  const p95 = _pct(s.values, 0.95);
  const max = s.values.reduce((currentMax, value) => Math.max(currentMax, value), 0);
  console.info(
    `[perf-audit] ${label}  n=${count}  avg=${avg.toFixed(3)}ms  p50=${p50.toFixed(3)}ms  p95=${p95.toFixed(3)}ms  max=${max.toFixed(3)}ms`,
  );
  s.values = [];
  s.lastFlush = now();
}

// ─── Counter store ────────────────────────────────────────────────────────────

interface CounterStore {
  label: string;
  counts: Record<string, number>;
  lastFlush: number;
}

const _counterStores = new Map<string, CounterStore>();

function _counterStore(label: string): CounterStore {
  let cs = _counterStores.get(label);
  if (!cs) {
    cs = { label, counts: {}, lastFlush: now() };
    _counterStores.set(label, cs);
  }
  return cs;
}

function _flushCounter(label: string, cs: CounterStore): void {
  const entries = Object.entries(cs.counts);
  if (entries.length === 0) return;
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const visibleEntries = entries.slice(0, MAX_COUNTER_KEYS_PER_LABEL);
  const hiddenCount = entries.length - visibleEntries.length;
  const parts = visibleEntries.map(([k, v]) => `${k}=${v}`).join('  ');
  console.info(`[perf-audit] ${label}  ${parts}`);
  if (hiddenCount > 0) {
    console.info(`[perf-audit] ${label}  (+${hiddenCount} more keys omitted)`);
  }
  cs.counts = {};
  cs.lastFlush = now();
}

function _recordCounter(label: string, key: string, increment = 1): void {
  const cs = _counterStore(label);
  cs.counts[key] = (cs.counts[key] ?? 0) + increment;
  if (now() - cs.lastFlush > FLUSH_INTERVAL_MS) {
    _flushCounter(label, cs);
  }
}

function _record(label: string, elapsed: number): void {
  const s = _store(label);
  s.values.push(elapsed);
  if (s.values.length > MAX_SAMPLES_PER_LABEL) {
    s.values.shift();
  }

  if (elapsed > 500) {
    // Spiky outlier — flush immediately to avoid dilution of cohort stats.
    _flush(label, s);
  } else if (now() - s.lastFlush > FLUSH_INTERVAL_MS) {
    _flush(label, s);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a synchronous measurement.
 * label  — dot-delimited path, e.g. "mergeMaindata" or "sortTorrents.name"
 * fn     — the function to wrap; its return value is propagated unchanged.
 *
 * When disabled the call overhead is a single boolean check.
 */
export function measure<T>(label: string, fn: () => T): T {
  if (!isPerfAuditEnabled()) return fn();
  const t0 = now();
  try {
    return fn();
  } finally {
    _record(label, now() - t0);
  }
}

/**
 * Async variant — wraps await and records wall-time including the suspension.
 */
export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isPerfAuditEnabled()) return fn();
  const t0 = now();
  try {
    return await fn();
  } finally {
    _record(label, now() - t0);
  }
}

/**
 * Flush all pending samples for a given label, or all labels if no label given.
 * Useful for manual verification in tests or console snippets.
 */
export function flushAudit(label?: string): void {
  if (label) {
    const s = _stores.get(label);
    if (s) _flush(label, s);
    const cs = _counterStores.get(label);
    if (cs) _flushCounter(label, cs);
  } else {
    for (const [lbl, s] of _stores) {
      _flush(lbl, s);
    }
    for (const [lbl, cs] of _counterStores) {
      _flushCounter(lbl, cs);
    }
  }
}

/**
 * Increment a named counter.
 * label   — dot-delimited path, e.g. "render.TorrentTable"
 * key     — sub-key within the counter, e.g. "mount" or "update"
 * n       — amount to add (default 1)
 *
 * Counters are aggregated and flushed on the same schedule as timing samples.
 * When disabled the call overhead is a single boolean check.
 */
export function count(label: string, key: string, n = 1): void {
  if (!isPerfAuditEnabled()) return;
  _recordCounter(label, key, n);
}

/**
 * Flush all pending counter samples for a given label, or all counter labels
 * if no label given.
 */
export function flushCounters(label?: string): void {
  if (label) {
    const cs = _counterStores.get(label);
    if (cs) _flushCounter(label, cs);
  } else {
    for (const [lbl, cs] of _counterStores) {
      _flushCounter(lbl, cs);
    }
  }
}

// ─── Mark support ─────────────────────────────────────────────────────────────

// Stable browser global for mark collection — survives module re-evaluation
declare global {
  interface Window {
    __TAURENT_PERF_MARKS__?: Record<string, number>;
  }
}

function _getMarks(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  if (!window.__TAURENT_PERF_MARKS__) {
    window.__TAURENT_PERF_MARKS__ = {};
  }
  return window.__TAURENT_PERF_MARKS__;
}

/**
 * Record a timestamp mark with a label.
 * No-op unless perf audit is enabled.
 * Logs [perf-audit] mark <label> t=<ms> via console.info when enabled.
 * Stores marks on window.__TAURENT_PERF_MARKS__ for Playwright/manual collection.
 */
export function mark(label: string): void {
  if (!isPerfAuditEnabled()) return;
  const t = now();
  const marks = _getMarks();
  marks[label] = t;
  console.info(`[perf-audit] mark ${label} t=${t.toFixed(3)}`);
}

/**
 * Returns a snapshot of all recorded marks.
 * Returns an empty object if not in a browser environment.
 */
export function getPerfMarks(): Record<string, number> {
  return Object.assign({}, _getMarks());
}

/**
 * Resets all recorded marks to empty.
 */
export function resetPerfMarks(): void {
  if (typeof window !== 'undefined' && window.__TAURENT_PERF_MARKS__) {
    window.__TAURENT_PERF_MARKS__ = {};
  }
}
