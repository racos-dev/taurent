// Infrastructure management for Tauri E2E tests.

import { execFile, spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, unlinkSync, readFileSync } from 'fs';
import http from 'http';
import net from 'net';
import { join, resolve } from 'path';
import { fileURLToPath } from 'node:url';
import type { ServerOptions } from '../testing/fake-qbittorrent.js';

// Resolved at module load: this file lives at apps/desktop/scripts/e2e/, so the
// repo root is four levels up. Artifact paths are anchored to the repo root so
// CI uploads (e.g. `artifacts/desktop/tauri-e2e`) resolve to the same location
// whether the runner is invoked from `apps/desktop` (the typical cwd) or from
// the repo root.
const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export function writemsg(msg: string): void {
  console.info(`[tauri:e2e] ${msg}`);
}

export function isVerboseE2ELog(): boolean {
  return process.env.TAURENT_TAURI_E2E_LOG === 'verbose';
}

export function verbosemsg(msg: string): void {
  if (isVerboseE2ELog()) {
    writemsg(msg);
  }
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

export function platform(): 'darwin' | 'linux' | 'windows' {
  const p = process.platform;
  if (p === 'darwin') return 'darwin';
  if (p === 'win32') return 'windows';
  return 'linux';
}

// ---------------------------------------------------------------------------
// Port utilities
// ---------------------------------------------------------------------------

export async function isTcpPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolveOpen) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolveOpen(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolveOpen(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolveOpen(false);
    });
  });
}

export async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    if (!(await isTcpPortOpen(port))) return port;
  }
  throw new Error(`No available TCP port found starting at ${startPort}`);
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Process cleanup
// ---------------------------------------------------------------------------

/**
 * Kill stale processes that are holding the specified ports.
 */
export async function killStaleProcesses(ports: number[]): Promise<void> {
  if (platform() === 'windows') {
    for (const port of ports) {
      try {
        const { stdout } = await new Promise<{ stdout: string }>((res, rej) => {
          execFile('netstat', ['-ano', '-p', 'TCP'], { windowsHide: true }, (err, stdout) => {
            if (err) { rej(err); return; }
            res({ stdout: stdout ?? '' });
          });
        });
        const lines = stdout.split('\n');
        for (const line of lines) {
          // Match the local address (field after `TCP`) and the trailing PID for
          // a `LISTENING` TCP row, e.g.
          //   TCP    0.0.0.0:18080          0.0.0.0:0              LISTENING       12345
          //   TCP    [::]:18080             [::]:0                 LISTENING       12345
          const match = line.match(/TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)/);
          if (!match) continue;
          const localAddress = match[1];
          const portMatch = localAddress.match(/:(\d+)$/);
          if (!portMatch) continue;
          if (parseInt(portMatch[1], 10) !== port) continue;
          const pid = parseInt(match[2], 10);
          if (!Number.isNaN(pid)) {
            await new Promise<void>((res) => {
              execFile('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true }, () => res());
            });
            writemsg(`[kill] Killed PID ${pid} on port ${port}`);
          }
        }
      } catch {
        // netstat failed, skip
      }
    }
  } else {
    for (const port of ports) {
      try {
        const stdout = await new Promise<string>((res, rej) => {
          execFile('lsof', ['-ti', `tcp:${port}`], { timeout: 5000 }, (err, out) => {
            if (err) { rej(err); return; }
            res(out ?? '');
          });
        });
        const pids = stdout.trim().split('\n').filter(Boolean).map((s) => parseInt(s, 10)).filter(Boolean);
        for (const pid of pids) {
          try {
            process.kill(pid, 'SIGTERM');
            writemsg(`[kill] Killed PID ${pid} on port ${port}`);
          } catch {
            // process already gone
          }
        }
      } catch {
        // lsof failed or no process found, skip
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Fake QBittorrent server
// ---------------------------------------------------------------------------

export async function startFakeQBitTorrentServer(
  scenario: ServerOptions['scenario'],
  port: number,
): Promise<{ url: string; stop: () => void }> {
  const { startFakeQBittorrentServer } = await import('../testing/fake-qbittorrent.js');
  const opts: Partial<ServerOptions> = { scenario, port, quiet: !isVerboseE2ELog() };
  return startFakeQBittorrentServer(opts);
}

// ---------------------------------------------------------------------------
// Vite dev server
// ---------------------------------------------------------------------------

interface ViteReadyResult {
  port: number;
  proc: ChildProcess;
}

/**
 * Start Vite dev server with automatic port fallback.
 */
export async function startViteDevServer(
  cwd: string,
  preferredPort: number,
): Promise<ViteReadyResult> {
  const port = await findAvailablePort(preferredPort);
  const usePreferred = port === preferredPort;

  writemsg(`Starting Vite dev server on port ${port}${usePreferred ? '' : ' (preferred port busy)'}`);

  const proc = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd,
    shell: platform() === 'windows',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let ready = false;
  let stderrData = '';

  proc.stdout?.on('data', (d) => {
    const line = String(d).trim();
    if (line) verbosemsg(`[vite] ${line}`);
    if (line.includes('Local:') || line.includes('localhost')) ready = true;
  });
  proc.stderr?.on('data', (d) => {
    const line = String(d).trim();
    if (line) {
      verbosemsg(`[vite:err] ${line}`);
      stderrData += line + '\n';
    }
  });

  // Poll for port readiness
  let attempts = 0;
  while (!ready && attempts < 120) {
    ready = await isTcpPortOpen(port);
    if (ready) break;
    await sleep(500);
    attempts++;
  }

  if (!ready) {
    proc.kill();
    throw new Error(
      `Vite dev server did not start on port ${port} within 60s.\n` +
      `Stderr: ${stderrData.slice(0, 500)}`,
    );
  }

  writemsg(`Vite dev server ready on port ${port}`);
  return { port, proc };
}

// ---------------------------------------------------------------------------
// App binary discovery
// ---------------------------------------------------------------------------

export function findAppBinary(): string | null {
  const envPath = process.env.TAURENT_TAURI_APP_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  const releaseBases = [
    resolve(process.cwd(), 'src-tauri', 'target', 'release', 'debian'),
    resolve(process.cwd(), '..', '..', 'target', 'release', 'debian'),
    resolve(process.cwd(), 'src-tauri', 'target', 'release'),
    resolve(process.cwd(), '..', '..', 'target', 'release'),
    resolve(process.cwd(), 'src-tauri', 'target', 'debug'),
    resolve(process.cwd(), '..', '..', 'target', 'debug'),
  ];
  const candidates: string[] = [];

  for (const base of releaseBases) {
    if (platform() === 'windows') {
      candidates.push(
        join(base, 'taurent.exe'),
        join(base, 'Taurent.exe'),
        join(base, 'taurent-desktop.exe'),
        join(base, 'Taurent Desktop.exe'),
        join(base, 'taurent-desktop', 'taurent-desktop.exe'),
      );
    } else {
      candidates.push(
        join(base, 'taurent'),
        join(base, 'taurent-desktop'),
        join(base, 'Taurent Desktop'),
        join(base, 'Taurent'),
        join(base, 'Taurent Desktop.app'),
        join(base, 'bundle', 'macos', 'Taurent.app'),
      );
    }
  }

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Native diagnostics log
// ---------------------------------------------------------------------------

export function getE2EArtifactDir(): string {
  return join(REPO_ROOT, 'artifacts', 'desktop', 'tauri-e2e');
}

/**
 * Remove any leftover files from a previous run under the artifact directory.
 *
 * Called near the start of `main()` so stale screenshots (`failure.png`,
 * `main-window-ready.png`, etc.), the previous `current.json` artifact, and the
 * native page-load log are cleared before the current run writes new ones.
 */
export function cleanE2EArtifacts(): void {
  const artifactDir = getE2EArtifactDir();
  mkdirSync(artifactDir, { recursive: true });

  let entries: string[];
  try {
    entries = readdirSync(artifactDir);
  } catch (err) {
    writemsg(`Warning: failed to read artifact directory ${artifactDir}: ${(err as Error).message}`);
    return;
  }

  for (const entry of entries) {
    const entryPath = join(artifactDir, entry);
    try {
      rmSync(entryPath, { recursive: true, force: true });
    } catch (err) {
      writemsg(`Warning: failed to remove stale artifact ${entryPath}: ${(err as Error).message}`);
    }
  }
}

export function prepareNativeDiagnosticsLog(): string {
  const artifactDir = getE2EArtifactDir();
  mkdirSync(artifactDir, { recursive: true });

  const logPath = join(artifactDir, 'native-page-load.log');
  try {
    if (existsSync(logPath)) unlinkSync(logPath);
  } catch (err) {
    writemsg(`Warning: failed to reset native diagnostics log: ${(err as Error).message}`);
  }

  return logPath;
}

/**
 * Remove the WebView2 user data folder created for a single E2E run.
 *
 * The runner creates a fresh `webview-profile-<timestamp>` directory under the
 * artifact directory for every run and points WebView2 at it via the
 * `userDataFolder` option. Without explicit cleanup these directories
 * accumulate on the runner host (and on CI), so this helper is called from the
 * final cleanup block once the Tauri app process has been terminated and
 * released its file handles.
 */
export function removeWebviewProfile(profilePath: string): void {
  if (!existsSync(profilePath)) return;

  // On Windows, the app's WebView2 child processes can briefly hold file
  // handles on the profile directory after the parent process is killed.
  // Retry with backoff so the cleanup is robust to that race. On
  // macOS/Linux the release is effectively synchronous after the process
  // exits, so a single attempt is fine.
  const isWindows = platform() === 'windows';
  const maxAttempts = isWindows ? 5 : 1;
  const retryDelayMs = 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      rmSync(profilePath, { recursive: true, force: true });
      writemsg(`[cleanup] removed webview profile (attempt ${attempt}/${maxAttempts}): ${profilePath}`);
      return;
    } catch (err) {
      const message = (err as Error).message;
      if (attempt < maxAttempts) {
        verbosemsg(`[cleanup] remove attempt ${attempt}/${maxAttempts} failed: ${message}; retrying in ${retryDelayMs}ms`);
        // Synchronous sleep via Atomics + SharedArrayBuffer fallback to keep
        // this function sync (matches existing call sites in finally).
        const waitUntil = Date.now() + retryDelayMs;
        while (Date.now() < waitUntil) { /* spin */ }
      } else {
        writemsg(`Warning: failed to remove webview profile ${profilePath} after ${maxAttempts} attempt(s): ${message}`);
      }
    }
  }
}

export interface NativeDiagnosticsResult {
  logPath: string;
  lines: string[];
  error?: string;
}

export function readNativeDiagnostics(logPath: string, echoLines = false): NativeDiagnosticsResult {
  try {
    if (!existsSync(logPath)) {
      return { logPath, lines: [], error: 'Native diagnostics log was not created' };
    }

    const text = readFileSync(logPath, 'utf-8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    writemsg(`[native-diagnostics] ${lines.length} line(s) captured at ${logPath}`);
    if (echoLines || isVerboseE2ELog()) {
      for (const line of lines) writemsg(`[native] ${line}`);
    }
    return { logPath, lines };
  } catch (err) {
    return { logPath, lines: [], error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Tauri app launch
// ---------------------------------------------------------------------------

export interface AppLaunchResult {
  proc: ChildProcess;
  webviewDebugPort: number;
  userDataFolder: string;
  /** All stdout data from the app process (raw chunks). */
  capturedStdout: string[];
  /** All stderr data from the app process (raw chunks). */
  capturedStderr: string[];
}

/**
 * Launch the Tauri app with WebDriver and remote debugging ports configured.
 */
export function launchTauriApp(
  appPath: string,
  driverPort: number,
  webviewDebugPort: number,
  userDataFolder: string,
  nativeLogPath: string,
): AppLaunchResult {
  mkdirSync(userDataFolder, { recursive: true });

  writemsg(`WebDriver port: ${driverPort}`);
  writemsg(`WebView2 options: userDataFolder=${userDataFolder}, remote-debugging-port=${webviewDebugPort}`);
  writemsg(`Native diagnostics log: ${nativeLogPath}`);

  // On macOS, .app bundles are directory bundles and cannot be spawned directly.
  // We must either use `open -a` or spawn the actual executable inside the bundle.
  const resolvedPath = appPath.endsWith('.app') && platform() === 'darwin'
    ? join(appPath, 'Contents', 'MacOS', 'Taurent')
    : appPath;

  const capturedStdout: string[] = [];
  const capturedStderr: string[] = [];

  const appProc = spawn(resolvedPath, [], {
    env: {
      ...process.env,
      TAURENT_TAURI_E2E_NATIVE_LOG: nativeLogPath,
      // Redirect Rust server store into the same temp profile directory
      // that WebView2 uses so E2E runs are fully isolated.
      E2E_STORE_DIR: userDataFolder,
      // tauri-plugin-webdriver reads this when registered via init().
      TAURI_WEBDRIVER_PORT: String(driverPort),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  appProc.stdout?.on('data', (d) => {
    const text = String(d);
    capturedStdout.push(text);
    for (const line of text.split('\n').filter((l) => l.trim())) {
      verbosemsg(`[app] ${line}`);
    }
  });
  appProc.stderr?.on('data', (d) => {
    const text = String(d);
    capturedStderr.push(text);
    for (const line of text.split('\n').filter((l) => l.trim())) {
      verbosemsg(`[app:err] ${line}`);
    }
  });
  appProc.on('error', (err) => {
    console.error(`[tauri:e2e] App process error: ${err.message}`);
  });

  return { proc: appProc, webviewDebugPort, userDataFolder, capturedStdout, capturedStderr };
}

/**
 * Probe the WebDriver `/status` endpoint to confirm the server is actually
 * serving the WebDriver protocol — not just that the TCP port is open.
 *
 * The standard WebDriver `/status` response shape is
 * `{"value": {<ready, message, ...>}}`. This helper returns true only when the
 * response is 2xx and the body parses as a JSON object that contains a
 * top-level `value` property. Any other outcome (connection refused, non-2xx
 * status, invalid JSON, missing `value` object) resolves to false.
 */
export async function probeWebDriverStatus(driverPort: number, timeoutMs = 5_000): Promise<boolean> {
  // Cap the per-request timeout so a single hung request does not eat the
  // entire budget, and leave room for at least a handful of polls.
  const perRequestTimeoutMs = Math.max(250, Math.min(1_000, Math.floor(timeoutMs / 3)));
  const pollIntervalMs = 200;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const ok = await probeWebDriverStatusOnce(driverPort, perRequestTimeoutMs);
    if (ok) return true;
    await sleep(pollIntervalMs);
  }
  return false;
}

function probeWebDriverStatusOnce(driverPort: number, perRequestTimeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const req = http.request(
      {
        host: '127.0.0.1',
        port: driverPort,
        path: '/status',
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeout: perRequestTimeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          // Drain the response so the socket can be released back to the pool.
          res.resume();
          finish(false);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf-8');
            const parsed: unknown = JSON.parse(body);
            if (
              parsed !== null
              && typeof parsed === 'object'
              && 'value' in parsed
              && typeof (parsed as { value: unknown }).value === 'object'
              && (parsed as { value: unknown }).value !== null
            ) {
              finish(true);
            } else {
              finish(false);
            }
          } catch {
            finish(false);
          }
        });
        res.on('error', () => finish(false));
      },
    );

    req.on('timeout', () => {
      req.destroy();
      finish(false);
    });
    req.on('error', () => finish(false));
    req.end();
  });
}

/**
 * Poll until the WebDriver port is open (tauri-plugin-webdriver server ready)
 * and its `/status` endpoint actually responds with the WebDriver status
 * payload. The TCP check alone is not enough: a stale or unrelated process can
 * grab the port and the runner would then fail much later in `createSession`
 * with an opaque error. Probing `/status` catches the common failure mode
 * where the Tauri binary was built without `--features webdriver`.
 */
export async function waitForAppReady(driverPort: number, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  let attempts = 0;
  const maxAttempts = Math.ceil(timeoutMs / 500);

  while (attempts < maxAttempts) {
    const ready = await isTcpPortOpen(driverPort);
    if (ready) {
      const statusReady = await probeWebDriverStatus(driverPort, 10_000);
      if (!statusReady) {
        throw new Error(
          `App opened TCP port ${driverPort} but the WebDriver /status endpoint did not become ready. ` +
            `If you are using --skip-build or TAURENT_TAURI_APP_PATH, ensure the binary was built with --features webdriver.`,
        );
      }
      const elapsed = Date.now() - start;
      writemsg(`App WebDriver server ready on port ${driverPort} after ${elapsed}ms`);
      return;
    }
    await sleep(500);
    attempts++;
  }

  throw new Error(`App did not start WebDriver server on port ${driverPort} within ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Process snapshot (Windows only)
// ---------------------------------------------------------------------------

export interface ProcessInfo {
  name?: string;
  processId?: number;
  executablePath?: string | null;
  commandLine?: string | null;
}

export interface ProcessSnapshot {
  label: string;
  processes: ProcessInfo[];
  error?: string;
}

export async function captureProcessSnapshot(label: string): Promise<ProcessSnapshot> {
  if (platform() !== 'windows') {
    return { label, processes: [], error: 'process snapshots are implemented for Windows only' };
  }

  const script = [
    '$ErrorActionPreference = "Stop"',
    '$pattern = "Taurent|msedgewebview2"',
    '$items = Get-CimInstance Win32_Process | Where-Object { ($_.Name -match $pattern) -or ($_.CommandLine -match $pattern) } | Select-Object Name,ProcessId,ExecutablePath,CommandLine',
    'if ($null -eq $items) { "[]" } else { $items | ConvertTo-Json -Depth 4 -Compress }',
  ].join('; ');

  return new Promise<ProcessSnapshot>((resolveSnapshot) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      { timeout: 10_000, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          resolveSnapshot({
            label,
            processes: [],
            error: `${error.message}${stderr ? `; stderr=${stderr.trim()}` : ''}`,
          });
          return;
        }

        try {
          const parsed: unknown = JSON.parse(stdout.trim() || '[]');
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          const processes = rows
            .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
            .map((row) => ({
              name: typeof row.Name === 'string' ? row.Name : undefined,
              processId: typeof row.ProcessId === 'number' ? row.ProcessId : undefined,
              executablePath: typeof row.ExecutablePath === 'string' ? row.ExecutablePath : null,
              commandLine: typeof row.CommandLine === 'string' ? row.CommandLine : null,
            }));
          writemsg(
            `[processes:${label}] ${processes.map((p) => `${p.name ?? '<unknown>'}#${p.processId ?? '?'}`).join(', ') || '<none>'}`,
          );
          resolveSnapshot({ label, processes });
        } catch (err) {
          resolveSnapshot({
            label,
            processes: [],
            error: `Failed to parse process JSON: ${(err as Error).message}; stdout=${stdout.slice(0, 500)}`,
          });
        }
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Process tree teardown
// ---------------------------------------------------------------------------

/**
 * Kill the Tauri app process and any orphaned WebView2 children.
 *
 * On macOS/Linux, `appProc.kill('SIGTERM')` is sufficient — the OS reaps
 * children. On Windows, `taskkill /F /T /PID <pid>` kills the parent and its
 * process tree, but WebView2 spawns `msedgewebview2.exe` processes via COM
 * which can survive a tree-kill. We follow up with a PowerShell scan for
 * orphan WebView2 processes whose `CommandLine` references the app's profile
 * folder, and kill each one.
 *
 * Never throws: any failure is logged so the runner's `finally` block can
 * always proceed to profile-dir cleanup.
 */
export async function killAppProcessTree(
  appProc: ChildProcess,
  userDataFolder: string,
): Promise<void> {
  if (platform() === 'windows') {
    await killAppProcessTreeWindows(appProc, userDataFolder);
    return;
  }
  try {
    appProc.kill('SIGTERM');
    writemsg(`[teardown] sent SIGTERM to app process (pid=${appProc.pid ?? '?'})`);
  } catch (err) {
    verbosemsg(`[teardown] SIGTERM failed: ${(err as Error).message}`);
  }
}

async function killAppProcessTreeWindows(
  appProc: ChildProcess,
  userDataFolder: string,
): Promise<void> {
  // 1. Kill the Tauri parent and its direct process tree.
  if (appProc.pid !== undefined) {
    try {
      await new Promise<void>((done) => {
        execFile(
          'taskkill',
          ['/F', '/T', '/PID', String(appProc.pid)],
          { timeout: 5_000, windowsHide: true },
          (error) => {
            if (error) {
              verbosemsg(`[teardown] taskkill /F /T /PID ${appProc.pid} failed: ${error.message}`);
            } else {
              writemsg(`[teardown] taskkill /F /T /PID ${appProc.pid} succeeded`);
            }
            done();
          },
        );
      });
    } catch (err) {
      verbosemsg(`[teardown] taskkill /F /T wrapper threw: ${(err as Error).message}`);
    }
  }

  // 2. Find orphan msedgewebview2.exe processes whose CommandLine references
  //    this profile folder. Reuse the captureProcessSnapshot PowerShell
  //    pattern: Get-CimInstance Win32_Process, filter by Name and
  //    CommandLine -like '*<basename>*'.
  const folderBasename = basenameOfFolder(userDataFolder);
  if (!folderBasename) {
    verbosemsg('[teardown] userDataFolder has no basename; skipping orphan scan');
    return;
  }

  let orphanPids: number[];
  try {
    const script = [
      '$ErrorActionPreference = "Stop"',
      `$folderName = ${psQuote(folderBasename)}`,
      '$items = Get-CimInstance Win32_Process | Where-Object { $_.Name -match "msedgewebview2" -and $_.CommandLine -like ("*" + $folderName + "*") } | Select-Object ProcessId',
      'if ($null -eq $items) { "[]" } else { $items | ConvertTo-Json -Depth 2 -Compress }',
    ].join('; ');

    orphanPids = await new Promise<number[]>((done) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-Command', script],
        { timeout: 10_000, windowsHide: true },
        (error, stdout) => {
          if (error) {
            verbosemsg(`[teardown] orphan scan failed: ${error.message}`);
            done([]);
            return;
          }
          try {
            const parsed: unknown = JSON.parse(stdout.trim() || '[]');
            const rows = Array.isArray(parsed) ? parsed : [parsed];
            const pids = rows
              .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
              .map((row) => (typeof row.ProcessId === 'number' ? row.ProcessId : NaN))
              .filter((pid) => Number.isFinite(pid) && pid > 0);
            done(pids);
          } catch (err) {
            verbosemsg(`[teardown] orphan scan parse failed: ${(err as Error).message}`);
            done([]);
          }
        },
      );
    });
  } catch (err) {
    verbosemsg(`[teardown] orphan scan wrapper threw: ${(err as Error).message}`);
    return;
  }

  if (orphanPids.length === 0) {
    verbosemsg(`[teardown] no orphan msedgewebview2 processes referencing '${folderBasename}'`);
    return;
  }

  writemsg(`[teardown] found ${orphanPids.length} orphan msedgewebview2 process(es) referencing '${folderBasename}'`);

  // 3. Kill each orphan.
  for (const pid of orphanPids) {
    try {
      await new Promise<void>((done) => {
        execFile(
          'taskkill',
          ['/F', '/PID', String(pid)],
          { timeout: 5_000, windowsHide: true },
          (error) => {
            if (error) {
              verbosemsg(`[teardown] taskkill /F /PID ${pid} failed: ${error.message}`);
            } else {
              writemsg(`[teardown] taskkill /F /PID ${pid} succeeded`);
            }
            done();
          },
        );
      });
    } catch (err) {
      verbosemsg(`[teardown] taskkill /F wrapper threw: ${(err as Error).message}`);
    }
  }
}

function basenameOfFolder(folderPath: string): string {
  // Manual basename to avoid pulling another import; the path uses posix
  // separators on Windows inside the runner since the folder path was
  // constructed with `join()` which uses the host separator. Handle both.
  const parts = folderPath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function psQuote(value: string): string {
  // Escape for embedding in a PowerShell single-quoted string literal.
  return `'${value.replace(/'/g, `''`)}'`;
}

// ---------------------------------------------------------------------------
// Sync diagnostic types and parser (T147.1 / T147.2)
// ---------------------------------------------------------------------------

/** Snapshot cost diagnostics emitted by T147.1's `get_maindata_snapshot()`. */
export interface SyncSnapshotTiming {
  serverId: string;
  generation: number;
  revision: number;
  rid: number;
  torrentCount: number;
  elapsedMs: number;
}

/** Lifecycle event from the sync manager observer log lines. */
export interface SyncLifecycleEvent {
  event:
    | 'started'           // LiveSyncManager started
    | 'replaced'          // Stopping existing before new
    | 'stop-signal'       // LiveSyncManager stop received
    | 'stopped'           // LiveSyncManager stopped
    | 'snapshot-updated'; // LiveSyncManager snapshot updated
  serverId: string;
  generation?: number;
  revision?: number;
  torrentCount?: number;
}

/** Structured sync evidence parsed from app process output. */
export interface SyncDiagnosticsResult {
  /** Timed `get_maindata_snapshot` calls (cost evidence). */
  snapshotTimings: SyncSnapshotTiming[];
  /** Observed manager lifecycle events. */
  lifecycleEvents: SyncLifecycleEvent[];
  /** Revision counter values in progression order. */
  revisionProgression: number[];
  /** True when snapshot timings were observed and no blockers were raised. */
  pass: boolean;
  /** Descriptions of why sync evidence is missing or incomplete. */
  blockers: string[];
}

/**
 * Parse app stdout/stderr lines for T147.1 sync diagnostic patterns.
 *
 * Matches the `info!` log lines emitted by `crates/qb-tauri/src/sync/registry.rs`
 * and `crates/qb-tauri/src/sync/manager.rs` after the T147.1 Rust diagnostics
 * were added.
 */
export function parseSyncDiagnostics(lines: string[]): SyncDiagnosticsResult {
  const snapshotPattern =
    /get_maindata_snapshot:\s*server_id=(\S+),\s*generation=(\d+),\s*revision=(\d+),\s*rid=(\d+),\s*torrent_count=(\d+),\s*elapsed_ms=([0-9.]+)/;
  const startedPattern =
    /LiveSyncManager started:\s*server_id=(\S+),\s*generation=(\d+)/;
  const replacedPattern =
    /Stopping existing sync manager before starting new one:\s*server_id=(\S+),\s*old_gen=(\d+)/;
  const stopSignalPattern =
    /LiveSyncManager stop received:\s*server_id=(\S+)/;
  const stoppedPattern =
    /LiveSyncManager stopped:\s*server_id=(\S+),\s*generation=(\d+)/;
  const snapshotUpdatedPattern =
    /LiveSyncManager snapshot updated:\s*server_id=(\S+),\s*generation=(\d+),\s*revision=(\d+),\s*torrent_count=(\d+)/;

  const snapshotTimings: SyncSnapshotTiming[] = [];
  const lifecycleEvents: SyncLifecycleEvent[] = [];
  const revisionProgression: number[] = [];
  const blockers: string[] = [];
  let foundAnySyncLog = false;

  for (const line of lines) {
    let m: RegExpExecArray | null;

    m = snapshotPattern.exec(line);
    if (m) {
      foundAnySyncLog = true;
      snapshotTimings.push({
        serverId: m[1],
        generation: Number(m[2]),
        revision: Number(m[3]),
        rid: Number(m[4]),
        torrentCount: Number(m[5]),
        elapsedMs: Number(m[6]),
      });
      continue;
    }

    m = startedPattern.exec(line);
    if (m) {
      foundAnySyncLog = true;
      lifecycleEvents.push({ event: 'started', serverId: m[1], generation: Number(m[2]) });
      continue;
    }

    m = replacedPattern.exec(line);
    if (m) {
      foundAnySyncLog = true;
      lifecycleEvents.push({ event: 'replaced', serverId: m[1], generation: Number(m[2]) });
      continue;
    }

    m = stopSignalPattern.exec(line);
    if (m) {
      foundAnySyncLog = true;
      lifecycleEvents.push({ event: 'stop-signal', serverId: m[1] });
      continue;
    }

    m = stoppedPattern.exec(line);
    if (m) {
      foundAnySyncLog = true;
      lifecycleEvents.push({ event: 'stopped', serverId: m[1], generation: Number(m[2]) });
      continue;
    }

    m = snapshotUpdatedPattern.exec(line);
    if (m) {
      foundAnySyncLog = true;
      lifecycleEvents.push({
        event: 'snapshot-updated',
        serverId: m[1],
        generation: Number(m[2]),
        revision: Number(m[3]),
        torrentCount: Number(m[4]),
      });
      revisionProgression.push(Number(m[3]));
      continue;
    }
  }

  if (!foundAnySyncLog) {
    blockers.push(
      'No sync diagnostic log lines found in app output. ' +
        'T147.1 diagnostics may not be reaching stdout/stderr, ' +
        'or the sync lifecycle was never exercised.',
    );
  }

  const pass = snapshotTimings.length > 0 && blockers.length === 0;

  return { snapshotTimings, lifecycleEvents, revisionProgression, pass, blockers };
}
