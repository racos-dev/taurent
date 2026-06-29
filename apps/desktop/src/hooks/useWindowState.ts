import { useLayoutEffect } from 'react';
import { getCurrentWindow, availableMonitors } from '@tauri-apps/api/window';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';

/**
 * Windows that are fixed-size and must not have their geometry restored.
 * Must mirror the Rust FIXED_SIZE_WINDOWS const in crates/qb-tauri/src/app_builder.rs.
 */
const FIXED_SIZE_WINDOWS = new Set([
  'settings',
  'statistics',
  'add-torrent',
  // dialog-host is the shared singleton window for all modal dialogs
  'dialog-host',
  // All dialog windows are fixed-size — never restore their geometry
  'transfer-limit-dialog',
  'torrent-share-limits-dialog',
  'torrent-numeric-dialog',
  'torrent-text-dialog',
  'rename-dialog',
  'confirm-dialog',
  'create-dialog',
  'edit-category-dialog',
  'torrent-delete-dialog',
  'category-select-dialog',
  'tag-select-dialog',
  'entity-confirm-dialog',
]);

interface UseWindowStateOptions {
  /** Window label. Fixed-size windows skip geometry restore. */
  label?: string;
}

// React StrictMode double-invokes useLayoutEffect in dev. Both invocations
// await this promise so the clamp + DPI refresh runs once and show() only
// fires after it completes.
let mainRestorePromise: Promise<void> | null = null;

/**
 * Clamp the window position (and size if needed) so it fits within the monitor
 * that contains the window's center point. Handles the case where restored
 * window geometry overflows the current display — e.g., when a user previously
 * had the window on a larger external monitor and then disconnected it.
 *
 * All Tauri monitor/position/size values are in physical pixels; we convert
 * to logical pixels only for the setPosition/setSize calls.
 */
async function clampToDisplayBounds(): Promise<void> {
  const window = getCurrentWindow();
  const [position, size, monitors] = await Promise.all([
    window.outerPosition(),
    window.outerSize(),
    availableMonitors(),
  ]);

  if (monitors.length === 0) return;

  const winRight = position.x + size.width;
  const winBottom = position.y + size.height;
  const winCenterX = position.x + size.width / 2;
  const winCenterY = position.y + size.height / 2;

  let bestMonitor = monitors[0];
  let bestOverlap = -1;

  for (const monitor of monitors) {
    const wa = monitor.workArea;
    const waRight = wa.position.x + wa.size.width;
    const waBottom = wa.position.y + wa.size.height;

    const overlapX = Math.max(0, Math.min(winRight, waRight) - Math.max(position.x, wa.position.x));
    const overlapY = Math.max(0, Math.min(winBottom, waBottom) - Math.max(position.y, wa.position.y));
    const overlap = overlapX * overlapY;

    const centerInWorkArea =
      winCenterX >= wa.position.x &&
      winCenterX <= waRight &&
      winCenterY >= wa.position.y &&
      winCenterY <= waBottom;

    if (centerInWorkArea && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMonitor = monitor;
    } else if (!centerInWorkArea && overlap > bestOverlap && bestOverlap < 0) {
      bestOverlap = overlap;
      bestMonitor = monitor;
    }
  }

  const wa = bestMonitor.workArea;
  const waRight = wa.position.x + wa.size.width;
  const waBottom = wa.position.y + wa.size.height;
  const scaleFactor = bestMonitor.scaleFactor;

  let clampedX = position.x;
  let clampedY = position.y;
  let clampedWidth = size.width;
  let clampedHeight = size.height;
  let needsPosition = false;
  let needsSize = false;

  if (size.width > wa.size.width) {
    clampedWidth = wa.size.width;
    needsSize = true;
  }
  if (size.height > wa.size.height) {
    clampedHeight = wa.size.height;
    needsSize = true;
  }

  const effectiveWidth = needsSize ? clampedWidth : size.width;
  const effectiveHeight = needsSize ? clampedHeight : size.height;

  if (clampedX + effectiveWidth > waRight) {
    clampedX = waRight - effectiveWidth;
    needsPosition = true;
  }
  if (clampedY + effectiveHeight > waBottom) {
    clampedY = waBottom - effectiveHeight;
    needsPosition = true;
  }
  if (clampedX < wa.position.x) {
    clampedX = wa.position.x;
    needsPosition = true;
  }
  if (clampedY < wa.position.y) {
    clampedY = wa.position.y;
    needsPosition = true;
  }

  if (needsPosition) {
    await window.setPosition(new LogicalPosition(clampedX / scaleFactor, clampedY / scaleFactor));
  }
  if (needsSize) {
    await window.setSize(new LogicalSize(clampedWidth / scaleFactor, clampedHeight / scaleFactor));
  }
}

/**
 * Run the post-creation safety pass exactly once per process. Subsequent
 * callers (StrictMode's second useLayoutEffect invocation in dev, or any
 * re-mount) await the same promise.
 *
 * The window is already built at its saved geometry on the correct display by
 * the Rust side (see build_main_window in lib.rs), so there is no position or
 * size to restore here. This pass only:
 *   1. clamps the window into the current display's work area (a no-op for
 *      valid saved geometry; a safety net if the monitor layout changed), and
 *   2. re-applies the current inner size, which nudges WKWebView to re-evaluate
 *      its backing scale factor for the current display — fixing blurry
 *      rendering on non-retina displays.
 * Both run while the window is still hidden, so show() reveals it in place.
 */
function ensureMainRestoreOnce(): Promise<void> {
  if (mainRestorePromise) return mainRestorePromise;
  mainRestorePromise = (async () => {
    try {
      await clampToDisplayBounds();

      const win = getCurrentWindow();
      const innerSize = await win.innerSize();
      await win.setSize(innerSize);
    } catch (error) {
      console.error('[useWindowState] post-creation pass failed:', error);
    }
  })();
  return mainRestorePromise;
}

export function useWindowState({ label }: UseWindowStateOptions = {}) {
  // useLayoutEffect (not useEffect) so the restore + show runs in the same
  // layout phase as the first DOM mutation, before the browser paints.
  //
  // We must NOT defer show() via requestAnimationFrame: macOS/WebKit throttles
  // (effectively suspends) rAF while a window is hidden, so a rAF-scheduled
  // show() would never fire — the window stays hidden until something else
  // shows it (e.g. a dock-icon click triggering the Rust show path). Instead we
  // show() directly. The window has a themed backgroundColor, so showing just
  // before the first content paint shows the theme color, not a white flash.
  useLayoutEffect(() => {
    let cancelled = false;

    const initWindowState = async () => {
      const window = getCurrentWindow();

      if (label && FIXED_SIZE_WINDOWS.has(label)) {
        if (!cancelled) await window.show();
        return;
      }

      await ensureMainRestoreOnce();
      if (cancelled) return;
      await window.show();
      // setFocus() brings the app to the front and makes the window key
      // (makeKeyAndOrderFront + activate on macOS). Without it, a window shown
      // while the app launched in the background stays behind other apps.
      await window.setFocus();
    };

    void initWindowState();
    return () => { cancelled = true; };
  }, [label]);
}
