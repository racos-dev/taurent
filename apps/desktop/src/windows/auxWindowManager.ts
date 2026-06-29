import { emit, listen } from '@tauri-apps/api/event';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';
import { WebviewWindow, getAllWebviewWindows } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { WebviewWindow as TauriWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { resolveCurrentThemeBackgroundRgba } from '@taurent/shared/theme/backgroundRuntime';

export interface AuxWindowConfig {
  label: string;
  route: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  decorations?: boolean;
  centerOverOpener?: boolean;
}

interface OpenOptions {
  payload?: Record<string, string>;
  /** If true, create the window hidden and do not auto-show it.
   *  Used to pre-bake windows in memory for snappy re-open after tray resume. */
  prebake?: boolean;
}

const DEFAULT_MIN_WIDTH = 400;
const DEFAULT_MIN_HEIGHT = 400;
const DEFAULT_RESIZABLE = true;
const DEFAULT_DECORATIONS = true;
const AUX_WINDOW_TIMEOUT_MS = 10_000;
const PREBAKE_QUERY_PARAM = '__prebake';
const READY_TIMEOUT_MS = 2_000;

// In-flight opens guard (label -> Promise)
const pendingOpens = new Map<string, Promise<TauriWebviewWindow>>();
const readyLabels = new Set<string>();
const readyListeners = new Set<string>();

function ensureReadyListener(label: string): void {
  if (readyListeners.has(label)) return;
  readyListeners.add(label);
  void listen(`${label}:ready`, () => {
    readyLabels.add(label);
  });
}

async function waitForAuxWindowReady(label: string): Promise<void> {
  ensureReadyListener(label);
  if (readyLabels.has(label)) return;

  await new Promise<void>((resolve) => {
    const startedAt = Date.now();
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      resolve();
    }, READY_TIMEOUT_MS);

    const intervalId = window.setInterval(() => {
      if (readyLabels.has(label) || Date.now() - startedAt >= READY_TIMEOUT_MS) {
        window.clearInterval(intervalId);
        window.clearTimeout(timeoutId);
        resolve();
      }
    }, 25);
  });
}

/**
 * Calculate the logical-pixel position to center a window of the given dimensions
 * over a target window. Returns null if the target window's geometry cannot be read.
 */
async function calculateCenterOverWindow(
  target: {
    outerPosition(): Promise<{ x: number; y: number }>;
    outerSize(): Promise<{ width: number; height: number }>;
    scaleFactor(): Promise<number>;
  },
  width: number,
  height: number,
): Promise<{ x: number; y: number } | null> {
  const pos = await target.outerPosition();
  const size = await target.outerSize();
  const scale = await target.scaleFactor();
  // outerPosition/outerSize are physical px; WebviewWindow x/y/width/height are logical px
  const logicalX = pos.x / scale;
  const logicalY = pos.y / scale;
  const logicalW = size.width / scale;
  const logicalH = size.height / scale;
  return {
    x: Math.round(logicalX + (logicalW - width) / 2),
    y: Math.round(logicalY + (logicalH - height) / 2),
  };
}

async function resolveCenterPosition(config: AuxWindowConfig): Promise<{ x?: number; y?: number; center: boolean }> {
  const { width, height, centerOverOpener } = config;
  let x: number | undefined;
  let y: number | undefined;
  let center = true;

  if (centerOverOpener) {
    try {
      const opener = getCurrentWindow();
      const result = await calculateCenterOverWindow(opener, width, height);
      if (result) {
        x = result.x;
        y = result.y;
        center = false;
      }
    } catch {
      // Fallback: center over the main window instead of the primary display
      try {
        const mainWindow = await WebviewWindow.getByLabel('main');
        if (mainWindow) {
          const result = await calculateCenterOverWindow(mainWindow, width, height);
          if (result) {
            x = result.x;
            y = result.y;
            center = false;
          }
        }
      } catch {
        // Main window also unavailable — keep center: true as last resort
      }
    }
  }

  return { x, y, center };
}

async function applyAuxWindowConfig(win: TauriWebviewWindow, config: AuxWindowConfig): Promise<void> {
  const { title, width, height, minWidth, minHeight, resizable } = config;

  // Reconfiguring an existing shared host is best-effort. Never prevent the
  // dialog from opening if a platform rejects a dynamic size/resizability call.
  await Promise.allSettled([
    win.setTitle(title),
    // Loosen min-size before resizing so moving from a tall dialog to a short
    // one (or narrow to wide) cannot be blocked by the previous dialog's mins.
    win.setMinSize(new LogicalSize(1, 1)),
  ]);
  await Promise.allSettled([
    win.setSize(new LogicalSize(width, height)),
    win.setResizable(resizable ?? DEFAULT_RESIZABLE),
  ]);
  await win.setMinSize(new LogicalSize(minWidth ?? DEFAULT_MIN_WIDTH, minHeight ?? DEFAULT_MIN_HEIGHT)).catch(() => undefined);

  if (config.centerOverOpener) {
    const { x, y } = await resolveCenterPosition(config);
    if (x !== undefined && y !== undefined) {
      await win.setPosition(new LogicalPosition(x, y)).catch(() => undefined);
    }
  }
}

/**
 * Open an auxiliary window. If it already exists, show/unminimize/focus it
 * and deliver a payload event via the window's own emit.
 *
 * NOTE: Window-state restoration is NOT done here — it is the responsibility
 * of the aux window's own useWindowState hook. This function only manages
 * creation/show/focus and payload delivery.
 */
export async function openAuxWindow(
  config: AuxWindowConfig,
  options: OpenOptions = {}
): Promise<WebviewWindow> {
  const { label, route, title, width, height, minWidth, minHeight, resizable, minimizable, maximizable, decorations } = config;
  const { payload, prebake } = options;
  ensureReadyListener(label);

  // When pre-baking, mark sessionStorage so:
  // - tauri://created handler knows to skip auto-show
  // - DialogWindowLayout knows to skip its own auto-show RAF
  if (prebake) {
    sessionStorage.setItem(`prebaking:${label}`, '1');
  }

  // Deduplicate rapid concurrent opens: await pending, then show/focus and deliver payload
  const pending = pendingOpens.get(label);
  if (pending) {
    const existing = await pending;
    // If pre-baking an already-pending window, just hide it again (it may have
    // auto-shown from the pending resolve) and return hidden.
    if (prebake) {
      await existing.hide();
      return existing;
    }
    await applyAuxWindowConfig(existing, config);
    if (payload) {
      await waitForAuxWindowReady(label);
      await emit(`${label}:navigate`, { route, payload });
    }
    await existing.show();
    await existing.unminimize();
    await existing.setFocus();
    return existing;
  }

  // Check if window already exists
  const existingWindows = await getAllWebviewWindows();
  const existing = existingWindows.find((w) => w.label === label);

  if (existing) {
    // If pre-baking an existing window, hide it to restore the hidden pre-bake state.
    if (prebake) {
      await existing.hide();
      return existing;
    }
    await applyAuxWindowConfig(existing, config);
    // Deliver payload before showing so a hidden pre-baked singleton does not
    // flash stale/default params when it becomes visible.
    if (payload) {
      await waitForAuxWindowReady(label);
      await emit(`${label}:navigate`, { route, payload });
    }

    // Window exists — show/unminimize/focus
    await existing.show();
    await existing.unminimize();
    await existing.setFocus();

    return existing;
  }

  // Build initial URL with query params from payload. For pre-baked windows,
  // also include an explicit URL marker so the target webview can reliably know
  // it must stay hidden. sessionStorage alone is not reliable here because the
  // opener and newly-created webview have separate timing/lifetimes.
  const urlSearchParams = new URLSearchParams(payload);
  if (prebake) {
    urlSearchParams.set(PREBAKE_QUERY_PARAM, '1');
  }
  const searchParams = urlSearchParams.size > 0 ? '?' + urlSearchParams.toString() : '';
  const url = `${route}${searchParams}`;

  // Determine center position relative to opener
  const { x, y, center } = await resolveCenterPosition(config);

  // Create new window (hidden — aux window's useWindowState will show it after restore)
  const win = new WebviewWindow(label, {
    url,
    title,
    width,
    height,
    minWidth: minWidth ?? DEFAULT_MIN_WIDTH,
    minHeight: minHeight ?? DEFAULT_MIN_HEIGHT,
    resizable: resizable ?? DEFAULT_RESIZABLE,
    minimizable,
    maximizable,
    decorations: decorations ?? DEFAULT_DECORATIONS,
    center,
    x,
    y,
    visible: false,
    // Match the current theme background so the OS-level webview background is correct
    // from the moment the window is created, preventing any color flash.
    backgroundColor: resolveCurrentThemeBackgroundRgba(),
  });

  win.once('tauri://destroyed', () => {
    pendingOpens.delete(label);
  });

  const openPromise = new Promise<TauriWebviewWindow>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingOpens.delete(label);
      const error = new Error(`[aux-window] Timed out waiting for window creation: ${label}`);
      console.error(error.message);
      reject(error);
    }, AUX_WINDOW_TIMEOUT_MS);

    win.once('tauri://created', () => {
      clearTimeout(timeoutId);
      pendingOpens.delete(label);
      // Skip auto-show if this call is pre-baking the window. The window was
      // created with visible:false so it stays hidden until a user-triggered
      // open shows/focuses the existing singleton.
      if (prebake) {
        // Be defensive: some platforms can briefly surface a just-created
        // webview during startup/focus changes. Keep pre-baked windows hidden
        // from both the manager and the dialog layout side.
        void win.hide();
        window.setTimeout(() => void win.hide(), 0);
        window.setTimeout(() => void win.hide(), 100);
      } else {
        // Show the window immediately on creation so the user gets visual feedback
        // on the first click, before the aux window's own useWindowState RAF fires.
        // backgroundColor is already set to the theme color so there is no color flash.
        void win.show();
      }
      resolve(win);
    });
    win.once('tauri://error', () => {
      clearTimeout(timeoutId);
      pendingOpens.delete(label);
      reject(new Error(`[aux-window] Creation error: ${label}`));
    });
  });

  pendingOpens.set(label, openPromise);
  return openPromise;
}

/**
 * Close an auxiliary window by label.
 */
export async function closeAuxWindow(label: string): Promise<void> {
  const pending = pendingOpens.get(label);
  if (pending) {
    // Wait for pending open to complete, then close
    const win = await pending;
    await win.close();
    pendingOpens.delete(label);
    return;
  }

  const allWindows = await getAllWebviewWindows();
  const existing = allWindows.find((w) => w.label === label);
  if (existing) {
    await existing.close();
  }
}


// ─── WindowLifecycle ─────────────────────────────────────────────────────────

interface WindowLifecycleConfig {
  label: string;
  route: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  decorations?: boolean;
  centerOverOpener?: boolean;
  /** 0 = no idle-close (window stays open until explicitly closed). */
  idleTtlMs: number;
}

interface LifecycleState {
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Creates a lifecycle manager for an auxiliary window.
 *
 * Provides:
 *  - `prebake()` — pre-create the window hidden for instant later open
 *  - `schedule()` — schedule an idle-close after idleTtlMs (no-op if idleTtlMs=0)
 *  - `cancel()` — cancel any pending idle-close
 *  - `dismiss(hide)` — hide the window and schedule idle-close
 *
 * Each window file creates one instance with its config and exports the
 * lifecycle methods it needs. The actual open/close/focus primitives live
 * in auxWindowManager so all windows share the same infrastructure.
 */
export function createWindowLifecycle(config: WindowLifecycleConfig) {
  const state: LifecycleState = { timer: undefined };

  function clearTimer(): void {
    if (state.timer !== undefined) {
      window.clearTimeout(state.timer);
      state.timer = undefined;
    }
  }

  return {
    /** Cancel any pending idle-close timer. */
    cancel(): void {
      clearTimer();
    },

    /**
     * Schedule the window to close after `idleTtlMs` of inactivity.
     * No-op if `idleTtlMs` is 0.
     */
    schedule(): void {
      if (config.idleTtlMs === 0) return;
      clearTimer();
      state.timer = window.setTimeout(() => {
        state.timer = undefined;
        void closeAuxWindow(config.label);
      }, config.idleTtlMs);
    },

    /**
     * Hide the window and schedule an idle-close (if configured).
     * @param hide - async function that hides the window (usually `win.hide()`)
     */
    async dismiss(hide: () => Promise<void>): Promise<void> {
      await hide();
      this.schedule();
    },

    /**
     * Pre-create the window hidden so it opens instantly when later requested.
     */
    prebake(): Promise<WebviewWindow> {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { idleTtlMs: _idle, ...winConfig } = config;
      return openAuxWindow(winConfig as Omit<WindowLifecycleConfig, 'idleTtlMs'>, { prebake: true });
    },

    /** Full AuxWindowConfig (without idleTtlMs) for use with openAuxWindow. */
    get windowConfig(): Omit<WindowLifecycleConfig, 'idleTtlMs'> {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { idleTtlMs: _idle, ...winConfig } = config;
      return winConfig as Omit<WindowLifecycleConfig, 'idleTtlMs'>;
    },
  };
}
